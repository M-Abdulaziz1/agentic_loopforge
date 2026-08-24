import sqlite3

from fastapi.testclient import TestClient

from api.loopforge.app import create_app
from api.loopforge import app as app_module
from api.loopforge.providers import LLMResponse
from api.loopforge.settings import Settings
from api.loopforge.sqlite_store import SQLiteStore


# Valid spec JSON so the real planner path produces a spec (no offline fallback).
_VALID_SPEC_JSON = (
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
        return LLMResponse(text=_VALID_SPEC_JSON, tokens_used=1)


def test_dataset_upload_profiles_masks_lists_gets_and_deletes_file(tmp_path) -> None:
    settings = Settings(dataset_storage_path=str(tmp_path / "datasets"), dataset_max_size_bytes=1024)
    client = TestClient(create_app(settings=settings))
    csv_body = b"email,phone,score\nalice@example.com,555-121-9999,10\nbob@example.com,555-121-0000,12\n"

    uploaded = client.post(
        "/api/datasets",
        data={"name": "Customers"},
        files={"file": ("customers.csv", csv_body, "text/csv")},
    )
    body = uploaded.json()
    dataset_id = body["id"]
    stored_path = tmp_path / "datasets" / dataset_id / "customers.csv"
    listed = client.get("/api/datasets")
    fetched = client.get(f"/api/datasets/{dataset_id}")

    assert uploaded.status_code == 201
    assert body["name"] == "Customers"
    assert body["filename"] == "customers.csv"
    assert body["kind"] == "csv"
    assert body["status"] == "ready"
    assert body["size_bytes"] == len(csv_body)
    assert "storage_path" not in body
    assert stored_path.exists()
    assert "alice@example.com" not in uploaded.text
    assert "555-121-9999" not in uploaded.text

    columns = {column["name"]: column for column in body["profile"]["columns"]}
    assert body["profile"]["row_count"] == 2
    assert body["profile"]["column_count"] == 3
    assert columns["email"]["pii_masked"] is True
    assert columns["email"]["sample"] == ["[REDACTED_EMAIL]", "[REDACTED_EMAIL]"]
    assert columns["phone"]["pii_masked"] is True
    assert all(value == "[REDACTED_PHONE]" for value in columns["phone"]["sample"])
    assert columns["score"]["pii_masked"] is False
    assert columns["score"]["sample"] == ["10", "12"]

    assert listed.status_code == 200
    assert listed.json()[0]["id"] == dataset_id
    assert "alice@example.com" not in listed.text
    assert fetched.status_code == 200
    assert fetched.json()["id"] == dataset_id
    assert "storage_path" not in fetched.json()
    assert "555-121-0000" not in fetched.text

    deleted = client.delete(f"/api/datasets/{dataset_id}")

    assert deleted.status_code == 204
    assert not stored_path.exists()
    assert client.get(f"/api/datasets/{dataset_id}").status_code == 404


def test_dataset_default_size_cap_accepts_common_large_csv(tmp_path) -> None:
    settings = Settings(dataset_storage_path=str(tmp_path / "datasets"))
    client = TestClient(create_app(settings=settings))
    csv_body = b"value\n" + (b"1\n" * (101 * 1024 * 1024 // 2))

    uploaded = client.post(
        "/api/datasets",
        files={"file": ("large_creditcard_style.csv", csv_body, "text/csv")},
    )

    assert uploaded.status_code == 201
    body = uploaded.json()
    assert body["filename"] == "large_creditcard_style.csv"
    assert body["status"] == "ready"
    assert body["profile"]["row_count"] > 100_000


def test_dataset_upload_rejects_unsupported_type_and_size_cap(tmp_path) -> None:
    settings = Settings(dataset_storage_path=str(tmp_path / "datasets"), dataset_max_size_bytes=8)
    client = TestClient(create_app(settings=settings))

    unsupported = client.post(
        "/api/datasets",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    too_large = client.post(
        "/api/datasets",
        files={"file": ("large.csv", b"a\n123456789", "text/csv")},
    )

    assert unsupported.status_code == 415
    assert too_large.status_code == 413


def test_dataset_metadata_persists_in_sqlite_without_raw_pii(tmp_path) -> None:
    db_path = tmp_path / "loopforge.db"
    settings = Settings(dataset_storage_path=str(tmp_path / "datasets"))
    store = SQLiteStore(db_path)
    client = TestClient(create_app(store=store, settings=settings))

    uploaded = client.post(
        "/api/datasets",
        files={"file": ("customers.csv", b"email\nraw@example.com\n", "text/csv")},
    ).json()
    restarted = TestClient(create_app(store=SQLiteStore(db_path), settings=settings))
    fetched = restarted.get(f"/api/datasets/{uploaded['id']}")

    assert fetched.status_code == 200
    assert fetched.json()["profile"]["columns"][0]["sample"] == ["[REDACTED_EMAIL]"]
    with sqlite3.connect(db_path) as connection:
        payloads = "\n".join(row[0] for row in connection.execute("SELECT payload FROM records WHERE kind = 'dataset'"))
    assert "raw@example.com" not in payloads


def test_goal_with_dataset_exposes_masked_profile_to_planner(monkeypatch, tmp_path) -> None:
    llm = RecordingLLMProvider()
    monkeypatch.setattr(app_module, "create_llm_provider", lambda settings: llm)
    settings = Settings(dataset_storage_path=str(tmp_path / "datasets"))
    client = TestClient(app_module.create_app(settings=settings))
    dataset = client.post(
        "/api/datasets",
        files={"file": ("customers.csv", b"email,score\nsecret@example.com,10\n", "text/csv")},
    ).json()

    created = client.post(
        "/api/goals",
        json={"text": "Analyze customer score patterns in the uploaded dataset", "dataset_id": dataset["id"]},
    )

    assert created.status_code == 201
    assert created.json()["goal"]["dataset_id"] == dataset["id"]
    planner_prompt = llm.calls[-1][1]
    assert "customers.csv" in planner_prompt
    assert "email" in planner_prompt
    assert "score" in planner_prompt
    assert "[REDACTED_EMAIL]" in planner_prompt
    assert "secret@example.com" not in planner_prompt
