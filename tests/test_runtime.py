from api.loopforge.providers import DockerGvisorSandboxProvider, OpenAICompatibleLLMProvider
from api.loopforge.domain import Goal
from api.loopforge.runtime import create_execution_sandbox_provider, create_llm_provider, create_sandbox_provider
from api.loopforge.settings import LLMProviderMode, SandboxProviderMode, Settings


def test_runtime_creates_real_providers_by_default() -> None:
    settings = Settings()

    assert isinstance(create_llm_provider(settings), OpenAICompatibleLLMProvider)
    assert isinstance(create_sandbox_provider(settings), DockerGvisorSandboxProvider)


def test_runtime_creates_openai_compatible_llm_provider() -> None:
    settings = Settings(
        llm_provider=LLMProviderMode.OPENAI_COMPATIBLE,
        openai_compatible_base_url="http://local-llm.test/v1",
        openai_compatible_api_key="secret",
        openai_compatible_model="qwen2.5-coder",
    )

    provider = create_llm_provider(settings)

    assert isinstance(provider, OpenAICompatibleLLMProvider)
    assert provider.base_url == "http://local-llm.test/v1"
    assert provider.model == "qwen2.5-coder"


def test_runtime_creates_docker_gvisor_sandbox_provider(tmp_path) -> None:
    settings = Settings(
        sandbox_provider=SandboxProviderMode.DOCKER_GVISOR,
        docker_gvisor_runtime="runsc",
        docker_sandbox_image="python:3.12-slim",
        docker_workspace_root=str(tmp_path),
        docker_network="none",
        docker_memory="256m",
        docker_cpus="0.5",
    )

    provider = create_sandbox_provider(settings)

    assert isinstance(provider, DockerGvisorSandboxProvider)
    assert provider.runtime == "runsc"
    assert provider.image == "python:3.12-slim"
    assert provider.workspace_root == tmp_path
    assert provider.network == "none"
    assert provider.memory == "256m"
    assert provider.cpus == "0.5"


def test_execution_sandbox_provider_is_always_gvisor_for_code_runs(tmp_path) -> None:
    settings = Settings(sandbox_provider=SandboxProviderMode.DOCKER_GVISOR, docker_workspace_root=str(tmp_path))
    llm = create_llm_provider(settings)
    goal = Goal(text="Train a local fraud model")

    provider = create_execution_sandbox_provider(settings, llm=llm, goal=goal)

    assert isinstance(provider, DockerGvisorSandboxProvider)
    assert provider.workspace_root == tmp_path
