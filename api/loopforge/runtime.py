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


def create_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == LLMProviderMode.OPENAI_COMPATIBLE:
        return OpenAICompatibleLLMProvider(
            base_url=settings.openai_compatible_base_url,
            api_key=settings.openai_compatible_api_key,
            model=settings.openai_compatible_model,
            timeout_seconds=settings.openai_compatible_timeout_seconds,
        )
    return FakeLLMProvider()


def create_sandbox_provider(settings: Settings) -> SandboxProvider:
    if settings.sandbox_provider == SandboxProviderMode.DOCKER_GVISOR:
        return DockerGvisorSandboxProvider(
            runtime=settings.docker_gvisor_runtime,
            image=settings.docker_sandbox_image,
            workspace_root=settings.docker_workspace_root,
            network=settings.docker_network,
            memory=settings.docker_memory,
            cpus=settings.docker_cpus,
        )
    return FakeSandboxProvider()
