from __future__ import annotations

import os
from enum import StrEnum

from pydantic import BaseModel, Field


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

    @property
    def opencode_base_url(self) -> str:
        return f"http://{self.opencode_host}:{self.opencode_port}"

    @classmethod
    def from_env(cls) -> "Settings":
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
        )
