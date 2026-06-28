import json

from fastapi.testclient import TestClient

from api.loopforge.app import create_app


def create_approved_spec(client: TestClient, *, gates: list[str] | None = None) -> tuple[str, str]:
    created = client.post(
        "/api/goals",
        json={"text": "Create a three-step local-only backend release checklist"},
    ).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]
    if gates is not None:
        patch = client.patch(f"/api/loop-specs/{spec_id}", json={"gates": gates})
        assert patch.status_code == 200
    approve = client.post(f"/api/loop-specs/{spec_id}/approve")
    assert approve.status_code == 200
    return goal_id, spec_id


def test_start_run_requires_approved_loop_spec() -> None:
    client = TestClient(create_app())
    created = client.post(
        "/api/goals",
        json={"text": "Create a three-step local-only backend release checklist"},
    ).json()

    response = client.post(
        f"/api/goals/{created['goal']['id']}/runs",
        json={"loop_spec_id": created["loop_spec"]["id"]},
    )

    assert response.status_code == 409
    assert response.json() == {"detail": "Loop spec must be approved before running"}


def test_run_contract_lists_gets_cancels_and_pauses_runs() -> None:
    client = TestClient(create_app())
    goal_id, spec_id = create_approved_spec(client)

    started = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id})
    run = started.json()
    listed = client.get("/api/runs")
    fetched = client.get(f"/api/runs/{run['id']}")
    paused = client.post(f"/api/runs/{run['id']}/pause")
    cancelled = client.post(f"/api/runs/{run['id']}/cancel")

    assert started.status_code == 201
    assert run["status"] == "pending_approval"
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [run["id"]]
    assert fetched.status_code == 200
    assert fetched.json()["id"] == run["id"]
    assert paused.status_code == 200
    assert paused.json()["status"] == "pending_approval"
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def test_run_events_return_json_array_when_requested() -> None:
    client = TestClient(create_app())
    goal_id, spec_id = create_approved_spec(client)
    run = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id}).json()

    response = client.get(f"/api/runs/{run['id']}/events", headers={"Accept": "application/json"})
    events = response.json()

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert [event["seq"] for event in events] == sorted(event["seq"] for event in events)
    assert [event["type"] for event in events] == ["node_start", "gate_pending", "run_status"]


def test_run_events_stream_sse_for_terminal_run() -> None:
    client = TestClient(create_app())
    goal_id, spec_id = create_approved_spec(client, gates=[])
    run = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id}).json()

    with client.stream("GET", f"/api/runs/{run['id']}/events", headers={"Accept": "text/event-stream"}) as response:
        body = "".join(response.iter_text())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    data_lines = [line.removeprefix("data: ") for line in body.splitlines() if line.startswith("data: ")]
    events = [json.loads(line) for line in data_lines]
    assert events[-1]["type"] == "run_status"
    assert events[-1]["payload"]["status"] == "completed"


def test_gate_contract_lists_and_decides_pending_gates() -> None:
    client = TestClient(create_app())
    goal_id, spec_id = create_approved_spec(client)
    run = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id}).json()

    pending = client.get("/api/gates", params={"status": "pending", "run_id": run["id"]})
    gate = pending.json()[0]
    decided = client.post(f"/api/gates/{gate['id']}/decision", json={"decision": "approve", "note": "Looks good"})
    decide_again = client.post(f"/api/gates/{gate['id']}/decision", json={"decision": "reject"})

    assert pending.status_code == 200
    assert gate["status"] == "pending"
    assert decided.status_code == 200
    assert decided.json()["status"] == "approved"
    assert decided.json()["note"] == "Looks good"
    assert decide_again.status_code == 409
    assert decide_again.json() == {"detail": "Gate already decided"}
