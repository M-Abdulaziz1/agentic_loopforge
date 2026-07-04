from __future__ import annotations

from api.loopforge.agent_engine import AgentEngine, NativeReActEngine
from api.loopforge.domain import Goal, LLMProviderKind, StoredLLMProvider
from api.loopforge.opencode_engine import OpencodeEngine
from api.loopforge.providers import (
    DockerGvisorSandboxProvider,
    LLMProvider,
    LLMProviderError,
    OpenAICompatibleLLMProvider,
    SandboxProvider,
)
from api.loopforge.secrets import SecretCipher
from api.loopforge.settings import AgentEngineMode, LLMProviderMode, SandboxProviderMode, Settings
from api.loopforge.store import Store


def create_llm_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider != LLMProviderMode.OPENAI_COMPATIBLE:
        raise LLMProviderError(f"Unsupported LLM provider mode: {settings.llm_provider}")
    return OpenAICompatibleLLMProvider(
        base_url=settings.openai_compatible_base_url,
        api_key=settings.openai_compatible_api_key,
        model=settings.openai_compatible_model,
        timeout_seconds=settings.openai_compatible_timeout_seconds,
    )


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
    if settings.sandbox_provider != SandboxProviderMode.DOCKER_GVISOR:
        raise LLMProviderError(f"Unsupported sandbox provider mode: {settings.sandbox_provider}")
    return DockerGvisorSandboxProvider(
        runtime=settings.docker_gvisor_runtime,
        image=settings.docker_sandbox_image,
        workspace_root=settings.docker_workspace_root,
        network=settings.docker_network,
        memory=settings.docker_memory,
        cpus=settings.docker_cpus,
    )


def create_execution_sandbox_provider(settings: Settings, *, llm: LLMProvider, goal: Goal) -> SandboxProvider:
    return create_sandbox_provider(settings)


def create_agent_engine(settings: Settings, *, llm: LLMProvider, goal: Goal) -> AgentEngine:
    """Select the agent engine. Native ReAct is the default; opencode is opt-in.

    The opencode client is built lazily so the optional ``opencode-ai`` dependency
    is only required when the engine is actually selected. If it is missing or the
    server is unreachable, the engine surfaces an honest failure at run time rather
    than here.
    """
    if settings.agent_engine != AgentEngineMode.OPENCODE:
        return NativeReActEngine(llm)

    def _client():
        from opencode_ai import Opencode  # imported lazily; extra: .[opencode]

        return Opencode(base_url=settings.opencode_base_url)

    return OpencodeEngine(
        client_factory=_client,
        provider_id=settings.opencode_provider_id,
        model_id=settings.opencode_model_id,
        mode=goal.mode,
        opencode_mode=settings.opencode_mode,
    )
