import pytest


@pytest.fixture
def clear_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LOOPFORGE_LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LOOPFORGE_LLM_API_KEY", raising=False)
