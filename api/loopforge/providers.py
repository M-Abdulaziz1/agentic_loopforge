from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
import subprocess
from typing import Callable, Protocol
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


@dataclass(frozen=True)
class DatasetMount:
    host_path: str | Path
    filename: str


@dataclass(frozen=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str = ""


class SandboxProvider(Protocol):
    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount: DatasetMount | dict[str, object] | None = None) -> SandboxResult:
        raise NotImplementedError

    def open_session(self, *, dataset_mount: DatasetMount | dict[str, object] | None = None) -> "SandboxSession":
        raise NotImplementedError


class SandboxProviderError(RuntimeError):
    pass


class WorkspaceSecurityError(SandboxProviderError):
    """Raised when an agent tool tries to touch a path outside its workspace."""


class SandboxSession:
    """A persistent workspace shared across every tool call in one run.

    Files written by one ``run_python`` call survive to the next, so a real
    agentic loop can profile data, write a training script, run it, read the
    metrics it produced, and iterate — instead of a fresh throwaway sandbox
    per step. File I/O happens on the isolated host workspace directory; code
    execution is delegated to the provider (the container mounts *this* dir).
    """

    def __init__(
        self,
        *,
        workspace: Path,
        exec_python: Callable[[Path, str, int], SandboxResult],
    ) -> None:
        self.workspace = Path(workspace)
        self._exec_python = exec_python

    def run_python(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        return self._exec_python(self.workspace, code, timeout_seconds)

    def _resolve(self, path: str) -> Path:
        cleaned = str(path).strip()
        for prefix in ("/workspace/", "/workspace", "workspace/"):
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):]
                break
        cleaned = cleaned.lstrip("/") or "."
        target = (self.workspace / cleaned).resolve()
        root = self.workspace.resolve()
        if target != root and root not in target.parents:
            raise WorkspaceSecurityError(f"Path {path!r} escapes the workspace")
        return target

    def write_file(self, path: str, content: str) -> None:
        target = self._resolve(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def read_file(self, path: str, *, max_bytes: int = 40_000) -> str:
        target = self._resolve(path)
        if not target.exists():
            raise FileNotFoundError(f"{path} does not exist in the workspace")
        data = target.read_text(encoding="utf-8", errors="replace")
        return data[:max_bytes]

    def list_dir(self, path: str = ".") -> list[str]:
        target = self._resolve(path)
        if not target.exists():
            return []
        return sorted(p.name + ("/" if p.is_dir() else "") for p in target.iterdir())

    def close(self) -> None:  # pragma: no cover - best effort cleanup
        shutil.rmtree(self.workspace, ignore_errors=True)


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

    def open_session(self, *, dataset_mount: DatasetMount | dict[str, object] | None = None) -> SandboxSession:
        workspace = self.workspace_root / uuid4().hex
        workspace.mkdir(parents=True, exist_ok=False)
        (workspace / "data").mkdir(parents=True, exist_ok=True)
        (workspace / "output").mkdir(parents=True, exist_ok=True)
        mount = _normalize_dataset_mount(dataset_mount)

        def exec_python(ws: Path, code: str, timeout: int) -> SandboxResult:
            return self._run_in_workspace(ws, code, timeout_seconds=timeout, mount=mount)

        return SandboxSession(workspace=workspace, exec_python=exec_python)

    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount: DatasetMount | dict[str, object] | None = None) -> SandboxResult:
        workspace = self.workspace_root / uuid4().hex
        workspace.mkdir(parents=True, exist_ok=False)
        (workspace / "data").mkdir(parents=True, exist_ok=True)
        return self._run_in_workspace(
            workspace, code, timeout_seconds=timeout_seconds, mount=_normalize_dataset_mount(dataset_mount)
        )

    def _run_in_workspace(self, workspace: Path, code: str, *, timeout_seconds: int, mount: DatasetMount | None) -> SandboxResult:
        script = workspace / "main.py"
        script.write_text(code, encoding="utf-8")

        command = [
            "docker",
            "run",
            "--rm",
            f"--runtime={self.runtime}",
            f"--network={self.network}",
            "--read-only",
            "--security-opt=no-new-privileges",
            "--cap-drop=ALL",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            "--user",
            "65532:65532",
            f"--memory={self.memory}",
            f"--cpus={self.cpus}",
            "-v",
            f"{workspace}:/workspace:rw",
        ]
        if mount is not None:
            command.extend(["-v", f"{Path(mount.host_path)}:/workspace/data/{Path(mount.filename).name}:ro"])
        command.extend([
            "-w",
            "/workspace",
            self.image,
            "python",
            "/workspace/main.py",
        ])
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


def _normalize_dataset_mount(mount: DatasetMount | dict[str, object] | None) -> DatasetMount | None:
    if mount is None:
        return None
    if isinstance(mount, DatasetMount):
        return mount
    return DatasetMount(host_path=mount["host_path"], filename=str(mount["filename"]))
