from __future__ import annotations

from api.loopforge.domain import Goal, LLMProviderKind, StoredLLMProvider
from api.loopforge.providers import (
    DockerGvisorSandboxProvider,
    FakeLLMProvider,
    FakeSandboxProvider,
    LLMProvider,
    LLMProviderError,
    OpenAICompatibleLLMProvider,
    SandboxProvider,
)
from api.loopforge.secrets import SecretCipher
from api.loopforge.settings import LLMProviderMode, SandboxProviderMode, Settings
from api.loopforge.store import Store


def create_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == LLMProviderMode.OPENAI_COMPATIBLE:
        return OpenAICompatibleLLMProvider(
            base_url=settings.openai_compatible_base_url,
            api_key=settings.openai_compatible_api_key,
            model=settings.openai_compatible_model,
            timeout_seconds=settings.openai_compatible_timeout_seconds,
        )
    return FakeLLMProvider()


def create_llm_provider_from_config(config: StoredLLMProvider, settings: Settings) -> LLMProvider:
    if config.kind != LLMProviderKind.OPENAI_COMPATIBLE:
        raise LLMProviderError("LLM provider kind is not supported by the local runtime")
    api_key = SecretCipher(settings.secret_key).decrypt(config.encrypted_api_key) or settings.openai_compatible_api_key
    return OpenAICompatibleLLMProvider(
        base_url=config.base_url or settings.openai_compatible_base_url,
        api_key=api_key,
        model=config.model,
        timeout_seconds=config.timeout_seconds,
    )


def create_llm_provider_for_goal(store: Store, settings: Settings, goal: Goal) -> LLMProvider:
    if goal.llm_provider_id:
        return create_llm_provider_from_config(store.get_llm_provider(goal.llm_provider_id), settings)
    default_provider = store.get_default_llm_provider()
    if default_provider is not None:
        return create_llm_provider_from_config(default_provider, settings)
    return create_llm_provider(settings)


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
