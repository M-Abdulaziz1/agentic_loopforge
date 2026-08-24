from __future__ import annotations

import os
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, Field


def load_dotenv(path: str | os.PathLike[str] | None = None) -> None:
    """Load a ``.env`` file into ``os.environ`` (real env vars take precedence).

    A minimal KEY=VALUE reader — no dependency. Skips blank/comment lines, strips
    an optional ``export`` prefix and surrounding quotes, and never overrides a
    variable already set in the process environment.
    """
    env_path = Path(path or os.getenv("LOOPFORGE_ENV_FILE", ".env"))
    if not env_path.is_file():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.removeprefix("export ").partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


class LLMProviderMode(StrEnum):
    OPENAI_COMPATIBLE = "openai_compatible"


class SandboxProviderMode(StrEnum):
    DOCKER_GVISOR = "docker_gvisor"


class AgentEngineMode(StrEnum):
    NATIVE_REACT = "native_react"
    OPENCODE = "opencode"


class Settings(BaseModel):
    storage_path: str = ".loopforge/loopforge.db"
    dataset_storage_path: str = ".loopforge/datasets"
    dataset_max_size_bytes: int = 256 * 1024 * 1024
    secret_key: str = "loopforge-local-secret"
    llm_provider: LLMProviderMode = LLMProviderMode.OPENAI_COMPATIBLE
    sandbox_provider: SandboxProviderMode = SandboxProviderMode.DOCKER_GVISOR
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
    # agent engine: LoopForge's native ReAct loop, or opencode running in-sandbox.
    agent_engine: AgentEngineMode = AgentEngineMode.NATIVE_REACT
    opencode_host: str = "127.0.0.1"
    opencode_port: int = 4096
    opencode_provider_id: str = "openai"
    opencode_model_id: str = "local-model"
    opencode_mode: str = "build"
    # In-sandbox opencode server. The image must carry the opencode binary plus the
    # DS package allowlist; the network must be an egress allowlist (fail-closed
    # default — the operator creates it), never the open default bridge.
    docker_opencode_image: str = "loopforge/opencode-sandbox:latest"
    docker_opencode_network: str = "loopforge-egress"
    # gVisor's netstack can't use Docker Desktop's internal resolver on a custom
    # bridge, so the serve container gets a real nameserver via a bind-mounted
    # resolv.conf. Comma-separated. Empty = don't override (prod/Linux default DNS);
    # sovereign/air-gapped deployments point this at their internal resolver.
    docker_opencode_dns: str = "1.1.1.1"
    # opencode's Bun server + in-sandbox DS work (pandas/xgboost) needs more than the
    # code-exec container's 512m; kept separate so raising it doesn't loosen that one.
    docker_opencode_memory: str = "2g"
    opencode_container_port: int = 4096
    opencode_startup_timeout_seconds: float = Field(default=30.0, gt=0)
    # ``session.chat`` blocks until the agent's whole turn finishes (minutes), so the
    # client read timeout must cover a full run — the SDK's 60s default kills it.
    opencode_request_timeout_seconds: float = Field(default=900.0, gt=0)

    @property
    def opencode_base_url(self) -> str:
        return f"http://{self.opencode_host}:{self.opencode_port}"

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        return cls(
            storage_path=os.getenv("LOOPFORGE_STORAGE_PATH", ".loopforge/loopforge.db"),
            dataset_storage_path=os.getenv("LOOPFORGE_DATASET_STORAGE_PATH", ".loopforge/datasets"),
            dataset_max_size_bytes=int(os.getenv("LOOPFORGE_DATASET_MAX_SIZE_BYTES", str(256 * 1024 * 1024))),
            secret_key=os.getenv("LOOPFORGE_SECRET_KEY", "loopforge-local-secret"),
            llm_provider=os.getenv("LOOPFORGE_LLM_PROVIDER", LLMProviderMode.OPENAI_COMPATIBLE.value),
            sandbox_provider=os.getenv("LOOPFORGE_SANDBOX_PROVIDER", SandboxProviderMode.DOCKER_GVISOR.value),
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
            agent_engine=os.getenv("LOOPFORGE_AGENT_ENGINE", AgentEngineMode.NATIVE_REACT.value),
            opencode_host=os.getenv("LOOPFORGE_OPENCODE_HOST", "127.0.0.1"),
            opencode_port=int(os.getenv("LOOPFORGE_OPENCODE_PORT", "4096")),
            opencode_provider_id=os.getenv("LOOPFORGE_OPENCODE_PROVIDER_ID", "openai"),
            opencode_model_id=os.getenv("LOOPFORGE_OPENCODE_MODEL_ID", "local-model"),
            opencode_mode=os.getenv("LOOPFORGE_OPENCODE_MODE", "build"),
            docker_opencode_image=os.getenv("LOOPFORGE_DOCKER_OPENCODE_IMAGE", "loopforge/opencode-sandbox:latest"),
            docker_opencode_network=os.getenv("LOOPFORGE_DOCKER_OPENCODE_NETWORK", "loopforge-egress"),
            docker_opencode_dns=os.getenv("LOOPFORGE_DOCKER_OPENCODE_DNS", "1.1.1.1"),
            docker_opencode_memory=os.getenv("LOOPFORGE_DOCKER_OPENCODE_MEMORY", "2g"),
            opencode_container_port=int(os.getenv("LOOPFORGE_OPENCODE_CONTAINER_PORT", "4096")),
            opencode_startup_timeout_seconds=float(os.getenv("LOOPFORGE_OPENCODE_STARTUP_TIMEOUT_SECONDS", "30")),
            opencode_request_timeout_seconds=float(os.getenv("LOOPFORGE_OPENCODE_REQUEST_TIMEOUT_SECONDS", "900")),
        )
