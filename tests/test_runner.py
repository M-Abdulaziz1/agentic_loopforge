from api.loopforge.domain import Budget, Goal, LoopSpec, LoopSpecAgent, RunStatus, ToolPermission
from api.loopforge.providers import FakeLLMProvider, FakeSandboxProvider
from api.loopforge.runner import LoopRunner
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import default_tool_registry


def make_spec(goal_id: str) -> LoopSpec:
    return LoopSpec(
        goal_id=goal_id,
        version=1,
        agents=[LoopSpecAgent(name="Executor", role="Execute", system_prompt="Do the work", tools=["local_workspace"])],
        tool_permissions=[ToolPermission(tool_name="local_workspace", enabled=True, reason="Store artifacts")],
        handoffs=[],
        success_criteria=["Result exists"],
        failure_criteria=["No result"],
        gates=["before_run"],
        context_policy={"max_context_tokens": 1000},
        improvement_strategy="Revise once",
        status="approved",
    )


def test_runner_completes_approved_loop_and_records_events() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI"))
    spec = store.save_loop_spec(make_spec(goal.id))
    runner = LoopRunner(
        store=store,
        llm=FakeLLMProvider(),
        sandbox=FakeSandboxProvider(),
        tools=default_tool_registry(),
    )

    run = runner.start(goal, spec)

    assert run.status == RunStatus.COMPLETED
    assert run.result_summary == "Loop completed with deterministic fake providers."
    assert [event.type for event in store.list_events(run.id)] == [
        "run_started",
        "context_pack",
        "agent_step",
        "review",
        "run_completed",
    ]


def test_runner_stops_when_step_budget_is_exhausted() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI", budget=Budget(max_steps=1)))
    spec = store.save_loop_spec(make_spec(goal.id))
    runner = LoopRunner(
        store=store,
        llm=FakeLLMProvider(),
        sandbox=FakeSandboxProvider(),
        tools=default_tool_registry(),
    )

    run = runner.start(goal, spec)

    assert run.status == RunStatus.BUDGET_EXHAUSTED
    assert store.list_events(run.id)[-1].type == "budget_exhausted"
