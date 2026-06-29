from fastapi.testclient import TestClient

from api.loopforge.app import create_app
from api.loopforge.domain import AuditEvent
from api.loopforge.sqlite_store import SQLiteStore
from api.loopforge.store import InMemoryStore


def test_mutating_api_actions_write_audit_events() -> None:
    store = InMemoryStore()
    client = TestClient(create_app(store=store))

    created = client.post("/api/goals", json={"text": "Create a local backend release checklist"}).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]
    client.post(f"/api/loop-specs/{spec_id}/approve")
    run = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id}).json()
    gate = client.get("/api/gates", params={"status": "pending", "run_id": run["id"]}).json()[0]
    client.post(f"/api/gates/{gate['id']}/decision", json={"decision": "approve", "note": "ok"})

    events = store.list_audit_events()

    assert [event.action for event in events] == [
        "goal.create",
        "loop_spec.approve",
        "run.start",
        "gate.decision",
    ]
    assert events[-1].subject_type == "gate"
    assert events[-1].subject_id == gate["id"]
    assert events[-1].payload == {"decision": "approve", "note": "ok", "run_id": run["id"]}


def test_sqlite_store_persists_audit_events_after_reopen(tmp_path) -> None:
    db_path = tmp_path / "loopforge.db"
    store = SQLiteStore(db_path)
    event = store.append_audit_event(
        AuditEvent(
            action="gate.decision",
            subject_type="gate",
            subject_id="gate_1",
            payload={"decision": "approve"},
        )
    )

    reopened = SQLiteStore(db_path)

    assert reopened.list_audit_events()[0].id == event.id
    assert reopened.list_audit_events()[0].payload == {"decision": "approve"}
