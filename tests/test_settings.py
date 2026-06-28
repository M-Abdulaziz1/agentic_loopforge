from api.loopforge.settings import LLMProviderMode, SandboxProviderMode, Settings


def test_settings_default_to_fake_providers() -> None:
    settings = Settings()

    assert settings.llm_provider == LLMProviderMode.FAKE
    assert settings.sandbox_provider == SandboxProviderMode.FAKE
    assert settings.openai_compatible_base_url == "http://localhost:8000/v1"
    assert settings.openai_compatible_model == "local-model"
    assert settings.storage_path == ".loopforge/loopforge.db"


def test_settings_can_select_openai_compatible_and_gvisor_from_env(monkeypatch) -> None:
    monkeypatch.setenv("LOOPFORGE_LLM_PROVIDER", "openai_compatible")
    monkeypatch.setenv("LOOPFORGE_SANDBOX_PROVIDER", "docker_gvisor")
    monkeypatch.setenv("LOOPFORGE_OPENAI_COMPATIBLE_BASE_URL", "http://localhost:8080/v1")
    monkeypatch.setenv("LOOPFORGE_OPENAI_COMPATIBLE_MODEL", "qwen2.5-coder")
    monkeypatch.setenv("LOOPFORGE_DOCKER_GVISOR_RUNTIME", "runsc")
    monkeypatch.setenv("LOOPFORGE_STORAGE_PATH", "/tmp/loopforge-test.db")

    settings = Settings.from_env()

    assert settings.llm_provider == LLMProviderMode.OPENAI_COMPATIBLE
    assert settings.sandbox_provider == SandboxProviderMode.DOCKER_GVISOR
    assert settings.openai_compatible_base_url == "http://localhost:8080/v1"
    assert settings.openai_compatible_model == "qwen2.5-coder"
    assert settings.docker_gvisor_runtime == "runsc"
    assert settings.storage_path == "/tmp/loopforge-test.db"
