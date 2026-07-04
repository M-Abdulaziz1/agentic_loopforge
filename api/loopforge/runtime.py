from __future__ import annotations

from api.loopforge.agent_engine import AgentEngine, NativeReActEngine
from api.loopforge.domain import Goal, LLMProviderKind, StoredLLMProvider
from api.loopforge.opencode_config import build_opencode_config
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
        opencode_image=settings.docker_opencode_image,
        opencode_network=settings.docker_opencode_network,
        opencode_container_port=settings.opencode_container_port,
        opencode_startup_timeout_seconds=settings.opencode_startup_timeout_seconds,
    )


def create_execution_sandbox_provider(settings: Settings, *, llm: LLMProvider, goal: Goal) -> SandboxProvider:
    return create_sandbox_provider(settings)


def create_agent_engine(
    settings: Settings, *, llm: LLMProvider, goal: Goal, sandbox: SandboxProvider | None = None
) -> AgentEngine:
    """Select the agent engine. Native ReAct is the default; opencode is opt-in.

    When opencode is selected and a ``sandbox`` is supplied, the engine launches
    ``opencode serve`` *inside* that sandbox per run (guardrail #1) with a
    locked-down ``opencode.json``, and connects to the server's own URL. Without a
    sandbox (e.g. unit tests) it falls back to a pre-existing server at
    ``settings.opencode_base_url``.

    The opencode client is built lazily so the optional ``opencode-ai`` dependency
    is only required when the engine is actually selected and reached at run time;
    if it is missing or the server is unreachable, the engine surfaces an honest
    failure at run time rather than here.
    """
    if settings.agent_engine != AgentEngineMode.OPENCODE:
        return NativeReActEngine(llm)

    def _client_from_url(url: str):
        from opencode_ai import Opencode  # imported lazily; extra: .[opencode]

        return Opencode(base_url=url)

    if sandbox is not None:
        config = build_opencode_config(
            provider_id=settings.opencode_provider_id,
            model_id=settings.opencode_model_id,
            mode=goal.mode,
        )
        env = _opencode_container_env(settings)

        def _launch(session):
            return sandbox.serve_opencode(session, config=config, env=env)

        return OpencodeEngine(
            provider_id=settings.opencode_provider_id,
            model_id=settings.opencode_model_id,
            mode=goal.mode,
            opencode_mode=settings.opencode_mode,
            server_launcher=_launch,
            client_from_url=_client_from_url,
        )

    return OpencodeEngine(
        client_factory=lambda: _client_from_url(settings.opencode_base_url),
        provider_id=settings.opencode_provider_id,
        model_id=settings.opencode_model_id,
        mode=goal.mode,
        opencode_mode=settings.opencode_mode,
    )


def _opencode_container_env(settings: Settings) -> dict[str, str]:
    """Env the in-sandbox opencode server needs to reach the selected model.

    For the OpenAI-compatible provider (incl. local vLLM/sovereign), pass the base
    URL and key opencode's ``openai`` provider expects. Real secrets come from the
    process env (Settings), never hard-coded, and are injected only into the
    isolated container.
    """
    env: dict[str, str] = {}
    if settings.opencode_provider_id == "openai":
        env["OPENAI_API_KEY"] = settings.openai_compatible_api_key
        env["OPENAI_BASE_URL"] = settings.openai_compatible_base_url
    elif settings.opencode_provider_id == "anthropic":
        env["ANTHROPIC_API_KEY"] = settings.openai_compatible_api_key
    return env
