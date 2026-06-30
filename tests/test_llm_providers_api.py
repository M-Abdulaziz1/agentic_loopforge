import sqlite3

from fastapi.testclient import TestClient

from api.loopforge import app as app_module
from api.loopforge.app import create_app
from api.loopforge.providers import LLMResponse
from api.loopforge.secrets import SecretCipher
from api.loopforge.sqlite_store import SQLiteStore
from api.loopforge.store import InMemoryStore


class RecordingLLMProvider:
    def __init__(self, text: str = "ok") -> None:
        self.text = text
        self.calls: list[tuple[str, str]] = []

    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        self.calls.append((system, prompt))
        return LLMResponse(text=self.text, tokens_used=2)


def test_llm_provider_crud_masks_api_key_and_keeps_one_default() -> None:
    client = TestClient(create_app())

    first = client.post(
        "/api/llm-providers",
        json={
            "name": "Local",
            "kind": "openai_compatible",
            "base_url": "http://localhost:1234/v1",
            "model": "qwen",
            "api_key": "local-secret",
            "timeout_seconds": 10,
            "is_default": True,
        },
    )
    second = client.post(
        "/api/llm-providers",
        json={
            "name": "Cloud",
            "kind": "openai_compatible",
            "base_url": "https://llm.example/v1",
            "model": "gpt-test",
            "api_key": "cloud-secret",
            "is_default": True,
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert "api_key" not in first.json()
    assert first.json()["has_api_key"] is True
    assert second.json()["is_default"] is True

    providers = client.get("/api/llm-providers").json()
    by_id = {provider["id"]: provider for provider in providers}
    assert by_id[first.json()["id"]]["is_default"] is False
    assert by_id[second.json()["id"]]["is_default"] is True
    assert all("api_key" not in provider for provider in providers)

    patched = client.patch(f"/api/llm-providers/{second.json()['id']}", json={"name": "Cloud Renamed"})
    fetched = client.get(f"/api/llm-providers/{second.json()['id']}")
    deleted = client.delete(f"/api/llm-providers/{first.json()['id']}")

    assert patched.status_code == 200
    assert patched.json()["name"] == "Cloud Renamed"
    assert patched.json()["has_api_key"] is True
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Cloud Renamed"
    assert deleted.status_code == 204


def test_llm_provider_key_is_not_stored_in_plaintext_in_sqlite(tmp_path) -> None:
    db_path = tmp_path / "loopforge.db"
    client = TestClient(create_app(store=SQLiteStore(db_path)))

    response = client.post(
        "/api/llm-providers",
        json={
            "name": "Local",
            "kind": "openai_compatible",
            "base_url": "http://localhost:1234/v1",
            "model": "qwen",
            "api_key": "super-secret-key",
        },
    )

    assert response.status_code == 201
    with sqlite3.connect(db_path) as connection:
        payloads = "\n".join(row[0] for row in connection.execute("SELECT payload FROM records WHERE kind = 'llm_provider'"))
    assert "super-secret-key" not in payloads
    assert response.json()["has_api_key"] is True


def test_provider_test_uses_configured_key_without_returning_it(monkeypatch) -> None:
    llm = RecordingLLMProvider(text="pong")
    seen: dict[str, object] = {}

    def build_provider(config, settings):
        seen["config"] = config
        return llm

    monkeypatch.setattr(app_module, "create_llm_provider_from_config", build_provider)
    client = TestClient(app_module.create_app())
    provider = client.post(
        "/api/llm-providers",
        json={
            "name": "Local",
            "kind": "openai_compatible",
            "base_url": "http://localhost:1234/v1",
            "model": "qwen",
            "api_key": "do-not-leak",
        },
    ).json()

    response = client.post(f"/api/llm-providers/{provider['id']}/test")

    assert response.status_code == 200
    assert response.json() == {"ok": True, "detail": "Provider test succeeded", "model": "qwen"}
    assert llm.calls == [("loopforge-provider-test", "Reply with OK.")]
    assert seen["config"].encrypted_api_key != "do-not-leak"
    assert SecretCipher("loopforge-local-secret").decrypt(seen["config"].encrypted_api_key) == "do-not-leak"
    assert "do-not-leak" not in response.text


def test_run_uses_goal_provider_then_default_provider(monkeypatch) -> None:
    store = InMemoryStore()
    selected_llm = RecordingLLMProvider(text="selected")
    default_llm = RecordingLLMProvider(text="default")
    env_llm = RecordingLLMProvider(text="env")
    created_for: list[str] = []

    def build_provider(config, settings):
        created_for.append(config.name)
        return selected_llm if config.name == "Selected" else default_llm

    monkeypatch.setattr(app_module, "create_llm_provider_from_config", build_provider)
    monkeypatch.setattr(app_module, "create_llm_provider", lambda settings: env_llm)
    client = TestClient(app_module.create_app(store=store))
    default_provider = client.post(
        "/api/llm-providers",
        json={"name": "Default", "kind": "openai_compatible", "model": "default-model", "api_key": "default-key", "is_default": True},
    ).json()
    selected_provider = client.post(
        "/api/llm-providers",
        json={"name": "Selected", "kind": "openai_compatible", "model": "selected-model", "api_key": "selected-key"},
    ).json()

    goal = client.post(
        "/api/goals",
        json={"text": "Create a three-step local-only backend release checklist", "llm_provider_id": selected_provider["id"]},
    ).json()
    spec_id = goal["loop_spec"]["id"]
    client.patch(f"/api/loop-specs/{spec_id}", json={"gates": []})
    client.post(f"/api/loop-specs/{spec_id}/approve")
    selected_run = client.post(f"/api/goals/{goal['goal']['id']}/runs", json={"loop_spec_id": spec_id})

    default_goal = client.post(
        "/api/goals",
        json={"text": "Create another local-only backend release checklist"},
    ).json()
    default_spec_id = default_goal["loop_spec"]["id"]
    client.patch(f"/api/loop-specs/{default_spec_id}", json={"gates": []})
    client.post(f"/api/loop-specs/{default_spec_id}/approve")
    default_run = client.post(f"/api/goals/{default_goal['goal']['id']}/runs", json={"loop_spec_id": default_spec_id})

    assert default_provider["is_default"] is True
    assert selected_run.status_code == 201
    assert default_run.status_code == 201
    assert created_for == ["Selected", "Default"]
    assert len(selected_llm.calls) == 1
    assert len(default_llm.calls) == 1
    assert [call[0] for call in env_llm.calls] == [
        "loop-planner-clarity",
        "loop-planner-spec",
        "loop-planner-spec",
        "loop-planner-clarity",
        "loop-planner-spec",
        "loop-planner-spec",
    ]
