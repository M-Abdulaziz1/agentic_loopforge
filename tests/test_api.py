from fastapi.testclient import TestClient

from api.loopforge.app import create_app


def test_goal_creation_returns_clarification_for_vague_goal() -> None:
    client = TestClient(create_app())

    response = client.post("/api/goals", json={"text": "make it better"})

    assert response.status_code == 201
    body = response.json()
    assert body["goal"]["status"] == "needs_clarification"
    assert body["clarification"]["missing_requirements"] == ["desired outcome", "success criteria"]


def test_clear_goal_generates_loop_spec_and_starts_run_after_approval() -> None:
    client = TestClient(create_app())

    created = client.post(
        "/api/goals",
        json={
            "text": "Create a three-step launch checklist for a local-only developer tool and save the result",
            "toggles": {"internet": False, "code_sandbox": True, "local_connectors": True},
        },
    ).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]

    approval = client.post(f"/api/loop-specs/{spec_id}/approve")
    assert approval.status_code == 200
    assert approval.json()["status"] == "approved"

    run_response = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id})
    assert run_response.status_code == 201
    run = run_response.json()
    assert run["status"] == "pending_approval"

    events = client.get(f"/api/runs/{run['id']}/events", headers={"Accept": "application/json"}).json()
    assert [event["type"] for event in events][-1] == "run_status"


def test_delete_goal_removes_it_and_its_runs() -> None:
    client = TestClient(create_app())

    created = client.post(
        "/api/goals",
        json={
            "text": "Create a three-step launch checklist for a local-only developer tool and save the result",
            "toggles": {"internet": False, "code_sandbox": True, "local_connectors": True},
        },
    ).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]
    client.post(f"/api/loop-specs/{spec_id}/approve")
    run = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id}).json()

    deleted = client.delete(f"/api/goals/{goal_id}")
    assert deleted.status_code == 204

    assert client.get(f"/api/goals/{goal_id}").status_code == 404
    assert goal_id not in [g["id"] for g in client.get("/api/goals").json()]
    assert run["id"] not in [r["id"] for r in client.get("/api/runs").json()]


def test_delete_missing_goal_returns_404() -> None:
    client = TestClient(create_app())
    assert client.delete("/api/goals/goal-missing").status_code == 404
