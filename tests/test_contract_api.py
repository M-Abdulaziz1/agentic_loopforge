from fastapi.testclient import TestClient

from api.loopforge.app import create_app


def test_cors_allows_vite_dev_origin() -> None:
    client = TestClient(create_app())

    response = client.options(
        "/api/goals",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_goal_contract_lists_and_gets_goals_newest_first() -> None:
    client = TestClient(create_app())

    first = client.post("/api/goals", json={"text": "Create a release checklist for the backend API"}).json()["goal"]
    second = client.post("/api/goals", json={"text": "Create a launch checklist for the frontend demo"}).json()["goal"]

    listed = client.get("/api/goals")
    fetched = client.get(f"/api/goals/{first['id']}")
    missing = client.get("/api/goals/goal_missing")

    assert listed.status_code == 200
    assert [goal["id"] for goal in listed.json()] == [second["id"], first["id"]]
    assert fetched.status_code == 200
    assert fetched.json()["id"] == first["id"]
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Goal not found"}


def test_goal_contract_returns_open_clarification_session_for_unclear_goal() -> None:
    client = TestClient(create_app())

    created = client.post("/api/goals", json={"text": "make it better"})
    body = created.json()
    goal_id = body["goal"]["id"]
    clarification = client.get(f"/api/goals/{goal_id}/clarification")

    assert created.status_code == 201
    assert body["goal"]["status"] == "needs_clarification"
    assert body["clarification"]["status"] == "open"
    assert body["loop_spec"] is None
    assert clarification.status_code == 200
    assert clarification.json()["status"] == "open"


def test_clarification_answer_generates_loop_spec_when_ready() -> None:
    client = TestClient(create_app())
    created = client.post("/api/goals", json={"text": "make it better"}).json()
    goal_id = created["goal"]["id"]
    question_id = created["clarification"]["questions"][0]["id"]

    response = client.post(
        f"/api/goals/{goal_id}/clarification/answers",
        json={
            "question_id": question_id,
            "answer": "Create a concise backend launch checklist with three concrete steps.",
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["clarification"]["status"] == "ready"
    assert body["clarification"]["missing_requirements"] == []
    assert body["loop_spec"]["goal_id"] == goal_id
    assert body["loop_spec"]["status"] == "draft"


def test_answering_all_clarification_questions_persists_loop_spec() -> None:
    client = TestClient(create_app())
    created = client.post("/api/goals", json={"text": "make it better"}).json()
    goal_id = created["goal"]["id"]
    question_id = created["clarification"]["questions"][0]["id"]

    response = client.post(
        f"/api/goals/{goal_id}/clarification/answers",
        json={"question_id": question_id, "answer": "A checklist"},
    )
    body = response.json()
    spec_id = body["loop_spec"]["id"]
    listed = client.get(f"/api/loop-specs?goal_id={goal_id}")
    fetched = client.get(f"/api/loop-specs/{spec_id}")

    assert response.status_code == 200
    assert body["clarification"]["status"] == "ready"
    assert body["loop_spec"] is not None
    assert listed.status_code == 200
    assert [spec["id"] for spec in listed.json()] == [spec_id]
    assert fetched.status_code == 200
    assert fetched.json()["id"] == spec_id


def test_loop_spec_contract_lists_gets_updates_and_approves_drafts() -> None:
    client = TestClient(create_app())
    created = client.post(
        "/api/goals",
        json={"text": "Create a three-step local-only backend release checklist"},
    ).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]

    listed = client.get(f"/api/loop-specs?goal_id={goal_id}")
    fetched = client.get(f"/api/loop-specs/{spec_id}")
    updated = client.patch(
        f"/api/loop-specs/{spec_id}",
        json={"success_criteria": ["Checklist has exactly three concrete steps"]},
    )
    approved = client.post(f"/api/loop-specs/{spec_id}/approve")
    approve_again = client.post(f"/api/loop-specs/{spec_id}/approve")

    assert listed.status_code == 200
    assert [spec["id"] for spec in listed.json()] == [spec_id]
    assert fetched.status_code == 200
    assert fetched.json()["id"] == spec_id
    assert updated.status_code == 200
    assert updated.json()["version"] == 2
    assert updated.json()["success_criteria"] == ["Checklist has exactly three concrete steps"]
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"
    assert approve_again.status_code == 409
    assert approve_again.json() == {"detail": "Loop spec is not in an approvable state"}


def test_loop_spec_patch_rejects_offline_internet_tool_escalation() -> None:
    client = TestClient(create_app())
    created = client.post(
        "/api/goals",
        json={
            "text": "Create a three-step local-only backend release checklist",
            "mode": "offline_local",
            "toggles": {"internet": False, "code_sandbox": True, "local_connectors": True},
        },
    ).json()
    spec_id = created["loop_spec"]["id"]

    response = client.patch(
        f"/api/loop-specs/{spec_id}",
        json={"tool_permissions": [{"tool_name": "web_search", "enabled": True, "reason": "Need internet"}]},
    )

    assert response.status_code == 422
    assert "internet" in response.json()["detail"]
