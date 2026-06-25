from fastapi.testclient import TestClient

from api.loopforge.app import create_app


def test_goal_creation_returns_clarification_for_vague_goal() -> None:
    client = TestClient(create_app())

    response = client.post("/api/goals", json={"text": "make it better"})

    assert response.status_code == 201
    body = response.json()
    assert body["goal"]["status"] == "needs_clarification"
    assert body["clarification"]["missing_requirements"] == ["desired outcome", "success criteria"]


def test_clear_goal_generates_loop_spec_and_run_completes_after_approval() -> None:
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
    assert run["status"] == "completed"

    events = client.get(f"/api/runs/{run['id']}/events").json()
    assert [event["type"] for event in events][-1] == "run_completed"
