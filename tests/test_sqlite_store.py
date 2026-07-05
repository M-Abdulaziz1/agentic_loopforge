import pytest
from fastapi.testclient import TestClient

from api.loopforge.app import create_app, create_store
from api.loopforge.domain import (
    Artifact,
    ClarificationQuestion,
    ClarificationSession,
    Gate,
    Goal,
    LoopSpec,
    LoopSpecAgent,
    Run,
    RunEvent,
)
from api.loopforge.sqlite_store import SQLiteStore
from api.loopforge.settings import Settings


def test_sqlite_store_persists_entities_after_reopen(tmp_path) -> None:
    db_path = tmp_path / "loopforge.db"
    store = SQLiteStore(db_path)
    goal = store.save_goal(Goal(text="Create a local backend checklist"))
    session = store.save_clarification(
        ClarificationSession(
            goal_id=goal.id,
            questions=[ClarificationQuestion(question="What output?", missing_requirement="desired outcome")],
            missing_requirements=["desired outcome"],
        )
    )
    spec = store.save_loop_spec(
        LoopSpec(
            goal_id=goal.id,
            version=1,
            agents=[LoopSpecAgent(name="Planner", role="Plan", system_prompt="Plan", tools=[])],
            handoffs=[],
            success_criteria=["Checklist exists"],
            failure_criteria=["No output"],
            gates=["before_run"],
            context_policy={"max_context_tokens": 8000},
            improvement_strategy="Revise once",
        )
    )
    run = store.save_run(Run(goal_id=goal.id, loop_spec_id=spec.id))
    event = store.append_event(RunEvent(run_id=run.id, seq=0, type="run_status", message="Started"))
    artifact = store.save_artifact(Artifact(run_id=run.id, kind="report", metadata={"summary": "Report ready"}))
    gate = store.save_gate(Gate(run_id=run.id, gate_type="before_run"))

    reopened = SQLiteStore(db_path)

    assert reopened.get_goal(goal.id).text == goal.text
    assert reopened.get_clarification_by_goal(goal.id).id == session.id
    assert reopened.list_loop_specs(goal_id=goal.id)[0].id == spec.id
    assert reopened.get_run(run.id).loop_spec_id == spec.id
    assert reopened.list_events(run.id)[0].id == event.id
    assert reopened.list_artifacts(run.id)[0].id == artifact.id
    assert reopened.get_gate(gate.id).run_id == run.id


def test_delete_goal_cascades_to_specs_runs_and_children(tmp_path) -> None:
    db_path = tmp_path / "loopforge.db"
    store = SQLiteStore(db_path)
    goal = store.save_goal(Goal(text="Duplicate goal to remove"))
    survivor = store.save_goal(Goal(text="Goal to keep"))
    store.save_clarification(
        ClarificationSession(
            goal_id=goal.id,
            questions=[ClarificationQuestion(question="What output?", missing_requirement="desired outcome")],
            missing_requirements=["desired outcome"],
        )
    )
    spec = store.save_loop_spec(
        LoopSpec(
            goal_id=goal.id,
            version=1,
            agents=[LoopSpecAgent(name="Planner", role="Plan", system_prompt="Plan", tools=[])],
            handoffs=[],
            success_criteria=["Checklist exists"],
            failure_criteria=["No output"],
            gates=["before_run"],
            context_policy={"max_context_tokens": 8000},
            improvement_strategy="Revise once",
        )
    )
    run = store.save_run(Run(goal_id=goal.id, loop_spec_id=spec.id))
    store.append_event(RunEvent(run_id=run.id, seq=0, type="run_status", message="Started"))
    store.save_artifact(Artifact(run_id=run.id, kind="report", metadata={"summary": "Report ready"}))
    store.save_gate(Gate(run_id=run.id, gate_type="before_run"))

    store.delete_goal(goal.id)

    reopened = SQLiteStore(db_path)
    with pytest.raises(KeyError):
        reopened.get_goal(goal.id)
    assert reopened.list_loop_specs(goal_id=goal.id) == []
    with pytest.raises(KeyError):
        reopened.get_run(run.id)
    assert reopened.list_events(run.id) == []
    assert reopened.list_artifacts(run.id) == []
    assert reopened.list_gates(run_id=run.id) == []
    # An unrelated goal is untouched.
    assert reopened.get_goal(survivor.id).text == "Goal to keep"


def test_delete_goal_raises_keyerror_for_unknown_goal(tmp_path) -> None:
    store = SQLiteStore(tmp_path / "loopforge.db")
    with pytest.raises(KeyError):
        store.delete_goal("goal-does-not-exist")


def test_create_app_can_reuse_sqlite_store_after_restart(tmp_path) -> None:
    db_path = tmp_path / "loopforge.db"
    client = TestClient(create_app(store=SQLiteStore(db_path)))
    created = client.post("/api/goals", json={"text": "Create a local backend release checklist"}).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]

    restarted = TestClient(create_app(store=SQLiteStore(db_path)))
    listed = restarted.get(f"/api/loop-specs?goal_id={goal_id}")
    fetched = restarted.get(f"/api/loop-specs/{spec_id}")

    assert listed.status_code == 200
    assert [spec["id"] for spec in listed.json()] == [spec_id]
    assert fetched.status_code == 200
    assert fetched.json()["id"] == spec_id


def test_create_store_uses_sqlite_when_storage_path_is_configured(tmp_path) -> None:
    db_path = tmp_path / "configured.db"
    store = create_store(Settings(storage_path=str(db_path)))

    assert isinstance(store, SQLiteStore)
