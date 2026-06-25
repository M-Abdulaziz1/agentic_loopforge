from api.loopforge.domain import Goal, LoopSpec, LoopSpecAgent, Run, RunEvent
from api.loopforge.store import InMemoryStore


def test_store_persists_goal_spec_run_and_ordered_events() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI"))
    spec = store.save_loop_spec(
        LoopSpec(
            goal_id=goal.id,
            version=1,
            agents=[LoopSpecAgent(name="Planner", role="Plan", system_prompt="Plan", tools=[])],
            handoffs=[],
            success_criteria=["Checklist exists"],
            failure_criteria=["No checklist"],
            gates=["before_run"],
            context_policy={"max_context_tokens": 1000},
            improvement_strategy="Revise once",
        )
    )
    run = store.save_run(Run(goal_id=goal.id, loop_spec_id=spec.id))
    first = store.append_event(RunEvent(run_id=run.id, seq=0, type="start", message="started"))
    second = store.append_event(RunEvent(run_id=run.id, seq=0, type="end", message="ended"))

    assert store.get_goal(goal.id).id == goal.id
    assert store.get_loop_spec(spec.id).id == spec.id
    assert store.get_run(run.id).id == run.id
    assert [event.seq for event in store.list_events(run.id)] == [1, 2]
    assert first.seq == 1
    assert second.seq == 2
