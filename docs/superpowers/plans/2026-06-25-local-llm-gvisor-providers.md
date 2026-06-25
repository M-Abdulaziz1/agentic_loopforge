# Local LLM and gVisor Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fake-only runtime wiring with configurable providers for cloud or local OpenAI-compatible LLM endpoints and Docker plus gVisor sandbox execution.

**Architecture:** Keep the existing `LLMProvider` and `SandboxProvider` protocols, and add concrete implementations selected by configuration. The OpenAI-compatible provider targets the standard chat completions shape so it can work with cloud providers, vLLM, LM Studio, Ollama gateways, or other local OpenAI-compatible endpoints. The Docker gVisor provider builds a constrained `docker run --runtime=<runsc>` command and is tested by command construction plus injectable command runners, with real execution kept behind opt-in integration tests.

**Tech Stack:** Python 3.12, Pydantic v2 settings-style models, httpx, subprocess, pytest, FastAPI.

---

## Scope Split

This plan implements provider configuration and provider implementations only. It does not add durable Postgres persistence, Celery workers, a React UI, online browser/search tools, Docker compose services, or live gVisor integration tests that require local Docker/runsc availability. Those are follow-up plans.

## File Structure

- Create `api/loopforge/settings.py`: environment-backed runtime settings and provider mode enums.
- Modify `api/loopforge/providers.py`: add `OpenAICompatibleLLMProvider`, `DockerGvisorSandboxProvider`, provider exceptions, command runner seams, and richer sandbox metadata.
- Modify `api/loopforge/app.py`: use settings-driven provider construction while keeping fake providers as default for tests.
- Create `api/loopforge/runtime.py`: factory functions that build LLM and sandbox providers from settings.
- Create `.env.example`: local/offline and cloud-compatible environment variables.
- Modify `README.md`: document fake, local LLM, cloud LLM, and gVisor provider modes.
- Modify `pyproject.toml`: move `httpx` into runtime dependencies because the OpenAI-compatible provider needs it outside tests.
- Create `tests/test_settings.py`: environment parsing and defaults.
- Create `tests/test_openai_compatible_provider.py`: mocked HTTP behavior for local/cloud compatible endpoints.
- Create `tests/test_docker_gvisor_provider.py`: command construction, timeout, and failure behavior.
- Create `tests/test_runtime.py`: provider factory behavior.
- Modify `tests/test_api.py`: verify the app defaults remain deterministic and can accept injected settings.

## Task 1: Runtime Settings

**Files:**
- Create: `api/loopforge/settings.py`
- Create: `tests/test_settings.py`
- Modify: `.env.example`

- [ ] **Step 1: Write failing settings tests**

Create `tests/test_settings.py`:

```python
from api.loopforge.settings import LLMProviderMode, SandboxProviderMode, Settings


def test_settings_default_to_fake_providers() -> None:
    settings = Settings()

    assert settings.llm_provider == LLMProviderMode.FAKE
    assert settings.sandbox_provider == SandboxProviderMode.FAKE
    assert settings.openai_compatible_base_url == "http://localhost:8000/v1"
    assert settings.openai_compatible_model == "local-model"


def test_settings_can_select_openai_compatible_and_gvisor_from_env(monkeypatch) -> None:
    monkeypatch.setenv("LOOPFORGE_LLM_PROVIDER", "openai_compatible")
    monkeypatch.setenv("LOOPFORGE_SANDBOX_PROVIDER", "docker_gvisor")
    monkeypatch.setenv("LOOPFORGE_OPENAI_COMPATIBLE_BASE_URL", "http://localhost:8080/v1")
    monkeypatch.setenv("LOOPFORGE_OPENAI_COMPATIBLE_MODEL", "qwen2.5-coder")
    monkeypatch.setenv("LOOPFORGE_DOCKER_GVISOR_RUNTIME", "runsc")

    settings = Settings.from_env()

    assert settings.llm_provider == LLMProviderMode.OPENAI_COMPATIBLE
    assert settings.sandbox_provider == SandboxProviderMode.DOCKER_GVISOR
    assert settings.openai_compatible_base_url == "http://localhost:8080/v1"
    assert settings.openai_compatible_model == "qwen2.5-coder"
    assert settings.docker_gvisor_runtime == "runsc"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_settings.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'api.loopforge.settings'`.

- [ ] **Step 3: Implement settings**

Create `api/loopforge/settings.py`:

```python
from __future__ import annotations

import os
from enum import StrEnum

from pydantic import BaseModel, Field


class LLMProviderMode(StrEnum):
    FAKE = "fake"
    OPENAI_COMPATIBLE = "openai_compatible"


class SandboxProviderMode(StrEnum):
    FAKE = "fake"
    DOCKER_GVISOR = "docker_gvisor"


class Settings(BaseModel):
    llm_provider: LLMProviderMode = LLMProviderMode.FAKE
    sandbox_provider: SandboxProviderMode = SandboxProviderMode.FAKE
    openai_compatible_base_url: str = "http://localhost:8000/v1"
    openai_compatible_api_key: str = "local-dev-key"
    openai_compatible_model: str = "local-model"
    openai_compatible_timeout_seconds: float = Field(default=60.0, gt=0)
    docker_gvisor_runtime: str = "runsc"
    docker_sandbox_image: str = "python:3.12-slim"
    docker_workspace_root: str = "/tmp/loopforge-workspaces"
    docker_network: str = "none"
    docker_memory: str = "512m"
    docker_cpus: str = "1.0"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            llm_provider=os.getenv("LOOPFORGE_LLM_PROVIDER", LLMProviderMode.FAKE.value),
            sandbox_provider=os.getenv("LOOPFORGE_SANDBOX_PROVIDER", SandboxProviderMode.FAKE.value),
            openai_compatible_base_url=os.getenv("LOOPFORGE_OPENAI_COMPATIBLE_BASE_URL", "http://localhost:8000/v1"),
            openai_compatible_api_key=os.getenv("LOOPFORGE_OPENAI_COMPATIBLE_API_KEY", "local-dev-key"),
            openai_compatible_model=os.getenv("LOOPFORGE_OPENAI_COMPATIBLE_MODEL", "local-model"),
            openai_compatible_timeout_seconds=float(os.getenv("LOOPFORGE_OPENAI_COMPATIBLE_TIMEOUT_SECONDS", "60")),
            docker_gvisor_runtime=os.getenv("LOOPFORGE_DOCKER_GVISOR_RUNTIME", "runsc"),
            docker_sandbox_image=os.getenv("LOOPFORGE_DOCKER_SANDBOX_IMAGE", "python:3.12-slim"),
            docker_workspace_root=os.getenv("LOOPFORGE_DOCKER_WORKSPACE_ROOT", "/tmp/loopforge-workspaces"),
            docker_network=os.getenv("LOOPFORGE_DOCKER_NETWORK", "none"),
            docker_memory=os.getenv("LOOPFORGE_DOCKER_MEMORY", "512m"),
            docker_cpus=os.getenv("LOOPFORGE_DOCKER_CPUS", "1.0"),
        )
```

- [ ] **Step 4: Add environment example**

Create `.env.example`:

```bash
# Provider modes: fake | openai_compatible
LOOPFORGE_LLM_PROVIDER=fake

# Provider modes: fake | docker_gvisor
LOOPFORGE_SANDBOX_PROVIDER=fake

# Works with cloud OpenAI-compatible APIs and local endpoints such as vLLM,
# LM Studio, Ollama OpenAI-compatible gateways, or internal inference servers.
LOOPFORGE_OPENAI_COMPATIBLE_BASE_URL=http://localhost:8000/v1
LOOPFORGE_OPENAI_COMPATIBLE_API_KEY=local-dev-key
LOOPFORGE_OPENAI_COMPATIBLE_MODEL=local-model
LOOPFORGE_OPENAI_COMPATIBLE_TIMEOUT_SECONDS=60

# Docker + gVisor sandbox settings.
LOOPFORGE_DOCKER_GVISOR_RUNTIME=runsc
LOOPFORGE_DOCKER_SANDBOX_IMAGE=python:3.12-slim
LOOPFORGE_DOCKER_WORKSPACE_ROOT=/tmp/loopforge-workspaces
LOOPFORGE_DOCKER_NETWORK=none
LOOPFORGE_DOCKER_MEMORY=512m
LOOPFORGE_DOCKER_CPUS=1.0
```

- [ ] **Step 5: Run settings tests**

Run:

```bash
./.venv/bin/python -m pytest tests/test_settings.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/loopforge/settings.py tests/test_settings.py .env.example
git commit -m "feat: add runtime provider settings"
```

## Task 2: OpenAI-Compatible LLM Provider

**Files:**
- Modify: `api/loopforge/providers.py`
- Modify: `pyproject.toml`
- Create: `tests/test_openai_compatible_provider.py`

- [ ] **Step 1: Write failing provider tests**

Create `tests/test_openai_compatible_provider.py`:

```python
import httpx
import pytest

from api.loopforge.providers import LLMProviderError, OpenAICompatibleLLMProvider


def test_openai_compatible_provider_posts_chat_completion_payload() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["authorization"] = request.headers["authorization"]
        seen["payload"] = request.read().decode()
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "planned loop"}}],
                "usage": {"total_tokens": 42},
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = OpenAICompatibleLLMProvider(
        base_url="http://local-llm.test/v1",
        api_key="secret",
        model="local-model",
        client=client,
    )

    response = provider.complete(system="system prompt", prompt="user prompt")

    assert seen["url"] == "http://local-llm.test/v1/chat/completions"
    assert seen["authorization"] == "Bearer secret"
    assert '"model":"local-model"' in str(seen["payload"])
    assert response.text == "planned loop"
    assert response.tokens_used == 42


def test_openai_compatible_provider_uses_token_fallback_when_usage_missing() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": [{"message": {"content": "short answer"}}]})

    provider = OpenAICompatibleLLMProvider(
        base_url="http://cloud-compatible.test/v1/",
        api_key="secret",
        model="cloud-model",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    response = provider.complete(system="system", prompt="prompt")

    assert response.text == "short answer"
    assert response.tokens_used > 0


def test_openai_compatible_provider_raises_clear_error_on_bad_response() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "bad"})

    provider = OpenAICompatibleLLMProvider(
        base_url="http://bad-provider.test/v1",
        api_key="secret",
        model="model",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    with pytest.raises(LLMProviderError, match="500"):
        provider.complete(system="system", prompt="prompt")
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_openai_compatible_provider.py -q
```

Expected: FAIL with missing `OpenAICompatibleLLMProvider` or `LLMProviderError`.

- [ ] **Step 3: Move httpx to runtime dependencies**

Modify `pyproject.toml` so dependencies include `httpx` and dev dependencies do not duplicate it:

```toml
dependencies = [
  "fastapi>=0.115,<1.0",
  "httpx>=0.27,<1.0",
  "pydantic>=2.8,<3.0",
  "uvicorn>=0.30,<1.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.2,<9.0",
]
```

- [ ] **Step 4: Implement OpenAI-compatible provider**

Modify `api/loopforge/providers.py` to include these imports and classes while preserving the existing fake providers:

```python
import httpx
```

Add after `LLMProvider`:

```python
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
```

- [ ] **Step 5: Run provider tests**

Run:

```bash
./.venv/bin/python -m pytest tests/test_openai_compatible_provider.py -q
```

Expected: PASS.

- [ ] **Step 6: Run all tests**

Run:

```bash
./.venv/bin/python -m pytest
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml api/loopforge/providers.py tests/test_openai_compatible_provider.py
git commit -m "feat: add openai compatible llm provider"
```

## Task 3: Docker gVisor Sandbox Provider

**Files:**
- Modify: `api/loopforge/providers.py`
- Create: `tests/test_docker_gvisor_provider.py`

- [ ] **Step 1: Write failing gVisor provider tests**

Create `tests/test_docker_gvisor_provider.py`:

```python
import subprocess

import pytest

from api.loopforge.providers import DockerGvisorSandboxProvider, SandboxProviderError


class RecordingRunner:
    def __init__(self, result: subprocess.CompletedProcess[str] | None = None) -> None:
        self.commands: list[list[str]] = []
        self.result = result or subprocess.CompletedProcess(args=[], returncode=0, stdout="ok", stderr="")

    def __call__(self, command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
        self.commands.append(command)
        return self.result


def test_docker_gvisor_provider_builds_constrained_run_command(tmp_path) -> None:
    runner = RecordingRunner()
    workspace = tmp_path / "workspace"
    provider = DockerGvisorSandboxProvider(
        runtime="runsc",
        image="python:3.12-slim",
        workspace_root=tmp_path,
        command_runner=runner,
    )

    result = provider.run_code("print('hello')", timeout_seconds=5)

    command = runner.commands[0]
    assert result.exit_code == 0
    assert result.stdout == "ok"
    assert command[:4] == ["docker", "run", "--rm", "--runtime=runsc"]
    assert "--network=none" in command
    assert "--read-only" in command
    assert "--user=65532:65532" in command
    assert "python:3.12-slim" in command
    assert workspace.parent == tmp_path


def test_docker_gvisor_provider_reports_nonzero_exit(tmp_path) -> None:
    runner = RecordingRunner(subprocess.CompletedProcess(args=[], returncode=2, stdout="", stderr="boom"))
    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path, command_runner=runner)

    result = provider.run_code("raise SystemExit(2)", timeout_seconds=5)

    assert result.exit_code == 2
    assert result.stderr == "boom"


def test_docker_gvisor_provider_raises_clear_timeout(tmp_path) -> None:
    def timeout_runner(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
        raise subprocess.TimeoutExpired(command, timeout)

    provider = DockerGvisorSandboxProvider(workspace_root=tmp_path, command_runner=timeout_runner)

    with pytest.raises(SandboxProviderError, match="timed out"):
        provider.run_code("while True: pass", timeout_seconds=1)
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_docker_gvisor_provider.py -q
```

Expected: FAIL with missing `DockerGvisorSandboxProvider` or `SandboxProviderError`.

- [ ] **Step 3: Implement Docker gVisor provider**

Modify `api/loopforge/providers.py` with these imports:

```python
from pathlib import Path
import subprocess
```

Add after `SandboxProvider`:

```python
class SandboxProviderError(RuntimeError):
    pass


CommandRunner = Callable[[list[str], int], subprocess.CompletedProcess[str]]


def run_subprocess(command: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


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
        command_runner: CommandRunner = run_subprocess,
    ) -> None:
        self.runtime = runtime
        self.image = image
        self.workspace_root = Path(workspace_root)
        self.network = network
        self.memory = memory
        self.cpus = cpus
        self.command_runner = command_runner

    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        workspace = self.workspace_root / f"run-{uuid4().hex[:12]}"
        workspace.mkdir(parents=True, exist_ok=False)
        script_path = workspace / "main.py"
        script_path.write_text(code, encoding="utf-8")

        command = [
            "docker",
            "run",
            "--rm",
            f"--runtime={self.runtime}",
            f"--network={self.network}",
            "--read-only",
            "--user=65532:65532",
            "--cap-drop=ALL",
            "--security-opt=no-new-privileges",
            f"--memory={self.memory}",
            f"--cpus={self.cpus}",
            "--tmpfs=/tmp:rw,noexec,nosuid,size=64m",
            f"--volume={workspace}:/workspace:rw",
            "--workdir=/workspace",
            self.image,
            "python",
            "/workspace/main.py",
        ]
        try:
            completed = self.command_runner(command, timeout_seconds)
        except subprocess.TimeoutExpired as exc:
            raise SandboxProviderError(f"Sandbox execution timed out after {timeout_seconds} seconds") from exc
        except OSError as exc:
            raise SandboxProviderError(f"Sandbox execution failed to start: {exc}") from exc
        return SandboxResult(exit_code=completed.returncode, stdout=completed.stdout, stderr=completed.stderr)
```

Also add `Callable` and `uuid4` imports:

```python
from typing import Callable, Protocol
from uuid import uuid4
```

- [ ] **Step 4: Run gVisor provider tests**

Run:

```bash
./.venv/bin/python -m pytest tests/test_docker_gvisor_provider.py -q
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run:

```bash
./.venv/bin/python -m pytest
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/loopforge/providers.py tests/test_docker_gvisor_provider.py
git commit -m "feat: add docker gvisor sandbox provider"
```

## Task 4: Runtime Provider Factories

**Files:**
- Create: `api/loopforge/runtime.py`
- Create: `tests/test_runtime.py`

- [ ] **Step 1: Write failing runtime factory tests**

Create `tests/test_runtime.py`:

```python
from api.loopforge.providers import DockerGvisorSandboxProvider, FakeLLMProvider, FakeSandboxProvider, OpenAICompatibleLLMProvider
from api.loopforge.runtime import build_llm_provider, build_sandbox_provider
from api.loopforge.settings import LLMProviderMode, SandboxProviderMode, Settings


def test_runtime_builds_fake_providers_by_default() -> None:
    settings = Settings()

    assert isinstance(build_llm_provider(settings), FakeLLMProvider)
    assert isinstance(build_sandbox_provider(settings), FakeSandboxProvider)


def test_runtime_builds_openai_compatible_provider() -> None:
    settings = Settings(
        llm_provider=LLMProviderMode.OPENAI_COMPATIBLE,
        openai_compatible_base_url="http://localhost:8000/v1",
        openai_compatible_api_key="key",
        openai_compatible_model="model",
    )

    provider = build_llm_provider(settings)

    assert isinstance(provider, OpenAICompatibleLLMProvider)
    assert provider.model == "model"


def test_runtime_builds_docker_gvisor_provider() -> None:
    settings = Settings(
        sandbox_provider=SandboxProviderMode.DOCKER_GVISOR,
        docker_gvisor_runtime="runsc",
        docker_sandbox_image="python:3.12-slim",
    )

    provider = build_sandbox_provider(settings)

    assert isinstance(provider, DockerGvisorSandboxProvider)
    assert provider.runtime == "runsc"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_runtime.py -q
```

Expected: FAIL with missing `api.loopforge.runtime`.

- [ ] **Step 3: Implement runtime factories**

Create `api/loopforge/runtime.py`:

```python
from __future__ import annotations

from api.loopforge.providers import (
    DockerGvisorSandboxProvider,
    FakeLLMProvider,
    FakeSandboxProvider,
    LLMProvider,
    OpenAICompatibleLLMProvider,
    SandboxProvider,
)
from api.loopforge.settings import LLMProviderMode, SandboxProviderMode, Settings


def build_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == LLMProviderMode.FAKE:
        return FakeLLMProvider()
    if settings.llm_provider == LLMProviderMode.OPENAI_COMPATIBLE:
        return OpenAICompatibleLLMProvider(
            base_url=settings.openai_compatible_base_url,
            api_key=settings.openai_compatible_api_key,
            model=settings.openai_compatible_model,
            timeout_seconds=settings.openai_compatible_timeout_seconds,
        )
    raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")


def build_sandbox_provider(settings: Settings) -> SandboxProvider:
    if settings.sandbox_provider == SandboxProviderMode.FAKE:
        return FakeSandboxProvider()
    if settings.sandbox_provider == SandboxProviderMode.DOCKER_GVISOR:
        return DockerGvisorSandboxProvider(
            runtime=settings.docker_gvisor_runtime,
            image=settings.docker_sandbox_image,
            workspace_root=settings.docker_workspace_root,
            network=settings.docker_network,
            memory=settings.docker_memory,
            cpus=settings.docker_cpus,
        )
    raise ValueError(f"Unsupported sandbox provider: {settings.sandbox_provider}")
```

- [ ] **Step 4: Run runtime tests**

Run:

```bash
./.venv/bin/python -m pytest tests/test_runtime.py -q
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run:

```bash
./.venv/bin/python -m pytest
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/loopforge/runtime.py tests/test_runtime.py
git commit -m "feat: add runtime provider factories"
```

## Task 5: Wire App to Settings

**Files:**
- Modify: `api/loopforge/app.py`
- Modify: `tests/test_api.py`

- [ ] **Step 1: Write failing app settings test**

Append to `tests/test_api.py`:

```python
from api.loopforge.settings import Settings


def test_app_accepts_explicit_settings_for_provider_selection() -> None:
    client = TestClient(create_app(settings=Settings()))

    response = client.post(
        "/api/goals",
        json={"text": "Create a short local-only checklist for this project"},
    )

    assert response.status_code == 201
    assert response.json()["loop_spec"]["agents"][0]["name"] == "Loop Planner"
```

- [ ] **Step 2: Run API tests to verify failure**

Run:

```bash
./.venv/bin/python -m pytest tests/test_api.py -q
```

Expected: FAIL with `TypeError: create_app() got an unexpected keyword argument 'settings'`.

- [ ] **Step 3: Wire app to runtime settings**

Modify `api/loopforge/app.py` imports:

```python
from api.loopforge.runtime import build_llm_provider, build_sandbox_provider
from api.loopforge.settings import Settings
```

Replace the `create_app` signature and provider setup with:

```python
def create_app(settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="LoopForge")
    settings = settings or Settings.from_env()
    store = InMemoryStore()
    llm = build_llm_provider(settings)
    planner = LoopPlanner(llm=llm)
    sandbox = build_sandbox_provider(settings)
    tools = default_tool_registry()
```

Keep the rest of the endpoint code unchanged.

- [ ] **Step 4: Run API tests**

Run:

```bash
./.venv/bin/python -m pytest tests/test_api.py -q
```

Expected: PASS.

- [ ] **Step 5: Run all tests**

Run:

```bash
./.venv/bin/python -m pytest
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/loopforge/app.py tests/test_api.py
git commit -m "feat: wire app runtime providers"
```

## Task 6: Documentation and Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README provider documentation**

Add this section to `README.md` after the first backend slice section:

````markdown
## Runtime Providers

LoopForge has deterministic fake providers for tests and configurable runtime providers for local or cloud-compatible execution.

Use fake providers:

```bash
LOOPFORGE_LLM_PROVIDER=fake
LOOPFORGE_SANDBOX_PROVIDER=fake
```

Use a local or cloud OpenAI-compatible LLM endpoint:

```bash
LOOPFORGE_LLM_PROVIDER=openai_compatible
LOOPFORGE_OPENAI_COMPATIBLE_BASE_URL=http://localhost:8000/v1
LOOPFORGE_OPENAI_COMPATIBLE_API_KEY=local-dev-key
LOOPFORGE_OPENAI_COMPATIBLE_MODEL=local-model
```

Use Docker plus gVisor for sandbox execution:

```bash
LOOPFORGE_SANDBOX_PROVIDER=docker_gvisor
LOOPFORGE_DOCKER_GVISOR_RUNTIME=runsc
LOOPFORGE_DOCKER_SANDBOX_IMAGE=python:3.12-slim
```

The OpenAI-compatible provider can point to a cloud provider, vLLM, LM Studio, an Ollama OpenAI-compatible gateway, or an internal inference server as long as it supports `/v1/chat/completions`.
````

- [ ] **Step 2: Run all tests**

Run:

```bash
./.venv/bin/python -m pytest
```

Expected: PASS.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only `README.md` is uncommitted.

- [ ] **Step 4: Commit docs**

```bash
git add README.md
git commit -m "docs: document runtime provider configuration"
```

## Plan Self-Review Checklist

- Spec coverage: this plan covers local/cloud-compatible LLM configuration, local OpenAI-compatible endpoint support, fake test providers, Docker plus gVisor sandbox provider, provider selection, `.env.example`, documentation, and tests around each boundary.
- Red-flag scan: no unresolved plan markers are present outside executable checkbox syntax.
- Type consistency: `Settings`, `LLMProviderMode`, `SandboxProviderMode`, `OpenAICompatibleLLMProvider`, `DockerGvisorSandboxProvider`, `LLMProviderError`, and `SandboxProviderError` are defined before use and referenced consistently.
