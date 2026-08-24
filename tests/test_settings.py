from api.loopforge.settings import LLMProviderMode, SandboxProviderMode, Settings, load_dotenv


def test_settings_default_to_real_local_providers() -> None:
    settings = Settings()

    assert settings.llm_provider == LLMProviderMode.OPENAI_COMPATIBLE
    assert settings.sandbox_provider == SandboxProviderMode.DOCKER_GVISOR
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


def test_load_dotenv_sets_missing_vars_but_never_overrides(tmp_path, monkeypatch) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        '# a comment\n'
        'export LOOPFORGE_AGENT_ENGINE=opencode\n'
        'LOOPFORGE_OPENAI_COMPATIBLE_MODEL="quoted-model"\n'
        '\n'
        'LOOPFORGE_STORAGE_PATH=/tmp/from-dotenv.db\n'
    )
    monkeypatch.delenv("LOOPFORGE_AGENT_ENGINE", raising=False)
    monkeypatch.delenv("LOOPFORGE_OPENAI_COMPATIBLE_MODEL", raising=False)
    monkeypatch.setenv("LOOPFORGE_STORAGE_PATH", "/tmp/from-real-env.db")  # real env wins

    load_dotenv(env_file)

    import os

    assert os.environ["LOOPFORGE_AGENT_ENGINE"] == "opencode"  # export prefix stripped
    assert os.environ["LOOPFORGE_OPENAI_COMPATIBLE_MODEL"] == "quoted-model"  # quotes stripped
    assert os.environ["LOOPFORGE_STORAGE_PATH"] == "/tmp/from-real-env.db"  # not overridden
