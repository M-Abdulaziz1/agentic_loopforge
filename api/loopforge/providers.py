from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import subprocess
from typing import Protocol
from uuid import uuid4

import httpx

from api.loopforge.context import estimate_tokens


@dataclass(frozen=True)
class LLMResponse:
    text: str
    tokens_used: int


class LLMProvider(Protocol):
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        raise NotImplementedError


class LLMProviderError(RuntimeError):
    pass


class OpenAICompatibleLLMProvider:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float = 60.0,
        client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=timeout_seconds)

    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0,
        }
        try:
            response = self.client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            raise LLMProviderError(f"OpenAI-compatible provider returned {exc.response.status_code}") from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(f"OpenAI-compatible provider request failed: {exc}") from exc
        except ValueError as exc:
            raise LLMProviderError("OpenAI-compatible provider returned invalid JSON") from exc

        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("OpenAI-compatible provider response did not include message content") from exc

        usage = data.get("usage") or {}
        tokens = usage.get("total_tokens")
        if not isinstance(tokens, int):
            tokens = estimate_tokens(system) + estimate_tokens(prompt) + estimate_tokens(text)
        return LLMResponse(text=text, tokens_used=tokens)


class FakeLLMProvider:
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        text = f"FAKE_RESPONSE system={system} prompt={prompt[:80]}"
        return LLMResponse(text=text, tokens_used=estimate_tokens(system) + estimate_tokens(prompt))


@dataclass(frozen=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str = ""


class SandboxProvider(Protocol):
    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        raise NotImplementedError


class SandboxProviderError(RuntimeError):
    pass


class DockerGvisorSandboxProvider:
    def __init__(
        self,
        *,
        runtime: str = "runsc",
        image: str = "python:3.12-slim",
        workspace_root: str | Path = "/tmp/loopforge-workspaces",
        network: str = "none",
        memory: str = "512m",
        cpus: str = "1.0",
        command_runner=None,
    ) -> None:
        self.runtime = runtime
        self.image = image
        self.workspace_root = Path(workspace_root)
        self.network = network
        self.memory = memory
        self.cpus = cpus
        self.command_runner = command_runner or self._run_subprocess

    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        workspace = self.workspace_root / uuid4().hex
        workspace.mkdir(parents=True, exist_ok=False)
        script = workspace / "main.py"
        script.write_text(code, encoding="utf-8")

        command = [
            "docker",
            "run",
            "--rm",
            f"--runtime={self.runtime}",
            f"--network={self.network}",
            "--read-only",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            "--user",
            "65532:65532",
            f"--memory={self.memory}",
            f"--cpus={self.cpus}",
            "-v",
            f"{workspace}:/workspace:ro",
            "-w",
            "/workspace",
            self.image,
            "python",
            "/workspace/main.py",
        ]
        try:
            completed = self.command_runner(command, timeout_seconds)
        except subprocess.TimeoutExpired as exc:
            raise SandboxProviderError(f"Docker gVisor sandbox timed out after {timeout_seconds}s") from exc
        except OSError as exc:
            raise SandboxProviderError(f"Docker gVisor sandbox failed to start: {exc}") from exc

        return SandboxResult(exit_code=completed.returncode, stdout=completed.stdout, stderr=completed.stderr)

    @staticmethod
    def _run_subprocess(command: list[str], timeout_seconds: int) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            timeout=timeout_seconds,
            capture_output=True,
            text=True,
            check=False,
        )


@dataclass
class FakeSandboxProvider:
    executions: list[str] = field(default_factory=list)

    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        self.executions.append(code)
        return SandboxResult(exit_code=0, stdout="sandbox execution simulated")
