from fastapi.testclient import TestClient

from api.loopforge.app import create_app
from api.loopforge.domain import LoopTemplate
from api.loopforge.sqlite_store import SQLiteStore


def create_spec(client: TestClient) -> tuple[str, str]:
    created = client.post(
        "/api/goals",
        json={"text": "Create a three-step local-only backend release checklist"},
    ).json()
    return created["goal"]["id"], created["loop_spec"]["id"]


def test_create_template_snapshots_loop_spec() -> None:
    client = TestClient(create_app())
    _, spec_id = create_spec(client)

    response = client.post(
        "/api/templates",
        json={"name": "Release checklist", "description": "Reusable backend release loop", "spec_id": spec_id},
    )
    body = response.json()

    assert response.status_code == 201
    assert body["name"] == "Release checklist"
    assert body["description"] == "Reusable backend release loop"
    source = client.get(f"/api/loop-specs/{spec_id}").json()
    assert body["agents"] == source["agents"]
    assert "status" not in body


def test_list_templates_returns_saved_templates() -> None:
    client = TestClient(create_app())
    _, spec_id = create_spec(client)
    created = client.post("/api/templates", json={"name": "Release checklist", "spec_id": spec_id}).json()

    response = client.get("/api/templates")

    assert response.status_code == 200
    assert [template["id"] for template in response.json()] == [created["id"]]


def test_instantiate_template_creates_new_draft_spec_for_goal() -> None:
    client = TestClient(create_app())
    _, source_spec_id = create_spec(client)
    target_goal_id, _ = create_spec(client)
    template = client.post("/api/templates", json={"name": "Release checklist", "spec_id": source_spec_id}).json()

    response = client.post(f"/api/templates/{template['id']}/instantiate", json={"goal_id": target_goal_id})
    body = response.json()

    assert response.status_code == 201
    assert body["goal_id"] == target_goal_id
    assert body["version"] == 1
    assert body["status"] == "draft"
    assert body["id"] != source_spec_id
    assert body["agents"] == template["agents"]


def test_delete_template_removes_saved_template() -> None:
    client = TestClient(create_app())
    _, spec_id = create_spec(client)
    template = client.post("/api/templates", json={"name": "Release checklist", "spec_id": spec_id}).json()

    deleted = client.delete(f"/api/templates/{template['id']}")
    listed = client.get("/api/templates")
    delete_again = client.delete(f"/api/templates/{template['id']}")

    assert deleted.status_code == 204
    assert listed.json() == []
    assert delete_again.status_code == 404


def test_template_endpoints_return_404_for_unknown_references() -> None:
    client = TestClient(create_app())
    goal_id, spec_id = create_spec(client)
    template = client.post("/api/templates", json={"name": "Release checklist", "spec_id": spec_id}).json()

    missing_spec = client.post("/api/templates", json={"name": "Missing spec", "spec_id": "spec_missing"})
    missing_template = client.post("/api/templates/template_missing/instantiate", json={"goal_id": goal_id})
    missing_goal = client.post(f"/api/templates/{template['id']}/instantiate", json={"goal_id": "goal_missing"})

    assert missing_spec.status_code == 404
    assert missing_template.status_code == 404
    assert missing_goal.status_code == 404


def test_sqlite_store_persists_templates_after_reopen(tmp_path) -> None:
    db_path = tmp_path / "loopforge.db"
    store = SQLiteStore(db_path)
    template = store.save_template(
        LoopTemplate(
            name="Release checklist",
            agents=[],
            tool_permissions=[],
            handoffs=[],
            success_criteria=["Done"],
            failure_criteria=["Failed"],
            gates=[],
            context_policy={"max_context_tokens": 8000},
            improvement_strategy="Revise once",
        )
    )

    reopened = SQLiteStore(db_path)

    assert reopened.get_template(template.id).name == "Release checklist"
    assert [saved.id for saved in reopened.list_templates()] == [template.id]
