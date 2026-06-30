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
    storage_path: str = ".loopforge/loopforge.db"
    dataset_storage_path: str = ".loopforge/datasets"
    dataset_max_size_bytes: int = 100 * 1024 * 1024
    secret_key: str = "loopforge-local-secret"
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
            storage_path=os.getenv("LOOPFORGE_STORAGE_PATH", ".loopforge/loopforge.db"),
            dataset_storage_path=os.getenv("LOOPFORGE_DATASET_STORAGE_PATH", ".loopforge/datasets"),
            dataset_max_size_bytes=int(os.getenv("LOOPFORGE_DATASET_MAX_SIZE_BYTES", str(100 * 1024 * 1024))),
            secret_key=os.getenv("LOOPFORGE_SECRET_KEY", "loopforge-local-secret"),
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
