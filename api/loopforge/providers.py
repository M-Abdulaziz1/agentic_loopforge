from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import shutil
import socket
import subprocess
import time
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


@dataclass
class OpencodeServerHandle:
    """A running in-sandbox ``opencode serve`` process the engine talks to over HTTP."""

    base_url: str
    container_id: str
    _stop: Callable[[], None]

    def stop(self) -> None:
        self._stop()


class SandboxProvider(Protocol):
    def run_code(self, code: str, *, timeout_seconds: int, dataset_mount: DatasetMount | dict[str, object] | None = None) -> SandboxResult:
        raise NotImplementedError

    def open_session(self, *, dataset_mount: DatasetMount | dict[str, object] | None = None) -> "SandboxSession":
        raise NotImplementedError

    def serve_opencode(self, session: "SandboxSession", *, config: dict, env: dict[str, str] | None = None) -> OpencodeServerHandle:
        """Launch ``opencode serve`` inside the sandbox for this run's workspace.

        Only implemented by providers that can host the opencode agent engine; the
        default provider (Docker+gVisor) does. Other providers may raise.
        """
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
        dataset_mount: DatasetMount | None = None,
    ) -> None:
        self.workspace = Path(workspace)
        self._exec_python = exec_python
        # Retained so an in-sandbox opencode server can mount the same read-only
        # dataset the native loop's run_python calls receive.
        self.dataset_mount = dataset_mount

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
        opencode_image: str | None = None,
        opencode_network: str = "loopforge-egress",
        opencode_container_port: int = 4096,
        opencode_startup_timeout_seconds: float = 30.0,
        readiness_probe: Callable[[str], bool] | None = None,
    ) -> None:
        self.runtime = runtime
        self.image = image
        self.workspace_root = Path(workspace_root)
        self.network = network
        self.memory = memory
        self.cpus = cpus
        self.command_runner = command_runner or self._run_subprocess
        # opencode agent engine runs its server in a *separate* image that carries
        # the opencode binary plus the DS package allowlist; it needs a reachable
        # port, so it cannot use network=none (see docs/opencode.md).
        self.opencode_image = opencode_image or image
        self.opencode_network = opencode_network
        self.opencode_container_port = opencode_container_port
        self.opencode_startup_timeout_seconds = opencode_startup_timeout_seconds
        self.readiness_probe = readiness_probe or _default_opencode_readiness_probe

    def open_session(self, *, dataset_mount: DatasetMount | dict[str, object] | None = None) -> SandboxSession:
        workspace = self.workspace_root / uuid4().hex
        workspace.mkdir(parents=True, exist_ok=False)
        (workspace / "data").mkdir(parents=True, exist_ok=True)
        (workspace / "output").mkdir(parents=True, exist_ok=True)
        mount = _normalize_dataset_mount(dataset_mount)

        def exec_python(ws: Path, code: str, timeout: int) -> SandboxResult:
            return self._run_in_workspace(ws, code, timeout_seconds=timeout, mount=mount)

        return SandboxSession(workspace=workspace, exec_python=exec_python, dataset_mount=mount)

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

        if _docker_infrastructure_failure(completed.stderr, completed.returncode):
            detail = _first_error_line(completed.stderr) or "docker run failed before Python started"
            raise SandboxProviderError(f"Docker gVisor sandbox infrastructure failed for runtime '{self.runtime}': {detail}")

        return SandboxResult(exit_code=completed.returncode, stdout=completed.stdout, stderr=completed.stderr)

    def serve_opencode(self, session: SandboxSession, *, config: dict, env: dict[str, str] | None = None) -> OpencodeServerHandle:
        """Start ``opencode serve`` inside a hardened gVisor container for this run.

        The locked-down ``opencode.json`` is written into the run workspace (which
        is bind-mounted), the read-only dataset is mounted the same way the native
        loop mounts it, and the server's API port is published only to host
        loopback. The container keeps the same isolation as code execution
        (gVisor, non-root, read-only root FS, writable ``/workspace`` + tmpfs). It
        runs on ``opencode_network`` rather than ``none`` because the API port must
        be reachable and the model endpoint must be egress-allowlisted; this is the
        one deliberate difference from the ``run_python`` container and is why the
        network must be an egress allowlist, not the open default bridge.
        """
        from api.loopforge.opencode_config import write_opencode_config

        workspace = session.workspace
        write_opencode_config(workspace, config)
        host_port = _free_tcp_port()
        base_url = f"http://127.0.0.1:{host_port}"

        command = [
            "docker",
            "run",
            "-d",
            f"--runtime={self.runtime}",
            f"--network={self.opencode_network}",
            "--read-only",
            "--security-opt=no-new-privileges",
            "--cap-drop=ALL",
            "--tmpfs",
            "/tmp:rw,noexec,nosuid,size=64m",
            "--user",
            "65532:65532",
            f"--memory={self.memory}",
            f"--cpus={self.cpus}",
            "-p",
            f"127.0.0.1:{host_port}:{self.opencode_container_port}",
            "-v",
            f"{workspace}:/workspace:rw",
            # opencode needs a writable HOME/XDG under the sole writable mount, and
            # discovers opencode.json from the working directory.
            "-e",
            "HOME=/workspace",
            "-e",
            "XDG_CONFIG_HOME=/workspace",
            "-e",
            "XDG_DATA_HOME=/workspace/.opencode-data",
        ]
        if session.dataset_mount is not None:
            mount = session.dataset_mount
            command.extend(["-v", f"{Path(mount.host_path)}:/workspace/data/{Path(mount.filename).name}:ro"])
        for key, value in (env or {}).items():
            command.extend(["-e", f"{key}={value}"])
        command.extend([
            "-w",
            "/workspace",
            self.opencode_image,
            "opencode",
            "serve",
            "--hostname",
            "0.0.0.0",
            "--port",
            str(self.opencode_container_port),
        ])

        try:
            completed = self.command_runner(command, int(self.opencode_startup_timeout_seconds) or 30)
        except subprocess.TimeoutExpired as exc:
            raise SandboxProviderError("opencode serve container timed out while starting") from exc
        except OSError as exc:
            raise SandboxProviderError(f"opencode serve container failed to start: {exc}") from exc

        if completed.returncode != 0 or not (completed.stdout or "").strip():
            detail = _first_error_line(completed.stderr) or "docker run -d returned no container id"
            raise SandboxProviderError(f"opencode serve container did not start: {detail}")
        container_id = completed.stdout.strip().splitlines()[-1].strip()

        def _stop() -> None:
            try:
                self.command_runner(["docker", "rm", "-f", container_id], 30)
            except (OSError, subprocess.SubprocessError):  # pragma: no cover - best effort
                pass

        deadline = time.monotonic() + self.opencode_startup_timeout_seconds
        while time.monotonic() < deadline:
            if self.readiness_probe(base_url):
                return OpencodeServerHandle(base_url=base_url, container_id=container_id, _stop=_stop)
            time.sleep(0.25)

        _stop()
        raise SandboxProviderError(
            f"opencode serve did not become ready within {self.opencode_startup_timeout_seconds}s at {base_url}"
        )

    @staticmethod
    def _run_subprocess(command: list[str], timeout_seconds: int) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            command,
            timeout=timeout_seconds,
            capture_output=True,
            text=True,
            check=False,
        )


def _free_tcp_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _default_opencode_readiness_probe(base_url: str) -> bool:
    """Ready as soon as the server answers HTTP at all (any status, even 404)."""
    try:
        httpx.get(base_url, timeout=2.0)
        return True
    except httpx.HTTPError:
        return False


def _docker_infrastructure_failure(stderr: str, exit_code: int) -> bool:
    if exit_code != 125:
        return False
    lowered = (stderr or "").lower()
    return any(
        marker in lowered
        for marker in (
            "unknown or invalid runtime name",
            "cannot connect to the docker daemon",
            "error response from daemon",
            "docker daemon",
        )
    )


def _first_error_line(stderr: str) -> str:
    return next((line.strip() for line in (stderr or "").splitlines() if line.strip()), "")


def _normalize_dataset_mount(mount: DatasetMount | dict[str, object] | None) -> DatasetMount | None:
    if mount is None:
        return None
    if isinstance(mount, DatasetMount):
        return mount
    return DatasetMount(host_path=mount["host_path"], filename=str(mount["filename"]))
