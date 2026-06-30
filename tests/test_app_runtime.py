from fastapi.testclient import TestClient

from api.loopforge import app as app_module
from api.loopforge.planner import CLARITY_SYSTEM, SPEC_SYSTEM
from api.loopforge.providers import FakeSandboxProvider, LLMResponse
from api.loopforge.settings import LLMProviderMode, Settings


# A real (non-offline) provider that returns valid JSON, so the planner takes the
# real path (no offline fallback) and a goal/spec is produced.
VALID_SPEC_JSON = (
    '{"agents": [{"name": "Analyst", "role": "analyze", '
    '"system_prompt": "Use the goal as data.", "tools": ["local_workspace"]}], '
    '"tool_permissions": [], "handoffs": [], "success_criteria": ["s"], '
    '"failure_criteria": ["f"], "context_policy": {}, "improvement_strategy": "i"}'
)


class RecordingLLMProvider:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        self.calls.append((system, prompt))
        return LLMResponse(text=VALID_SPEC_JSON, tokens_used=3)


def test_create_app_uses_runtime_factories_from_settings(monkeypatch) -> None:
    llm = RecordingLLMProvider()
    seen: dict[str, Settings] = {}

    def create_llm_provider(settings: Settings):
        seen["settings"] = settings
        return llm

    monkeypatch.setattr(app_module, "create_llm_provider", create_llm_provider)
    monkeypatch.setattr(app_module, "create_sandbox_provider", lambda settings: FakeSandboxProvider())
    settings = Settings(llm_provider=LLMProviderMode.OPENAI_COMPATIBLE)
    client = TestClient(app_module.create_app(settings=settings))

    response = client.post("/api/goals", json={"text": "Create a local backend release checklist"})

    assert response.status_code == 201
    assert seen["settings"] == settings
    # Valid JSON → clarity (ready) then one spec call, no retry/fallback.
    assert [call[0] for call in llm.calls] == [CLARITY_SYSTEM, SPEC_SYSTEM]
    assert "Create a local backend release checklist" in llm.calls[0][1]
