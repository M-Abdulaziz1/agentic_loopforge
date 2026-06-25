from api.loopforge.domain import (
    Budget,
    GoalCreate,
    GoalMode,
    GoalToggles,
    LoopSpec,
    LoopSpecAgent,
    RunStatus,
    ToolPermission,
)


def test_goal_create_defaults_to_offline_local() -> None:
    goal = GoalCreate(text="Research competitors and draft a launch plan")

    assert goal.mode == GoalMode.OFFLINE_LOCAL
    assert goal.toggles.internet is False
    assert goal.toggles.code_sandbox is True
    assert goal.budget.max_steps == 12


def test_loop_spec_records_agents_tools_and_success_criteria() -> None:
    spec = LoopSpec(
        goal_id="goal_1",
        version=1,
        agents=[
            LoopSpecAgent(
                name="Planner",
                role="Break down the goal",
                system_prompt="Create a plan and delegate work.",
                tools=["local_workspace"],
            )
        ],
        tool_permissions=[
            ToolPermission(tool_name="local_workspace", enabled=True, reason="Store artifacts")
        ],
        handoffs=[{"from": "Planner", "to": "Executor", "condition": "plan approved"}],
        success_criteria=["User receives an actionable plan"],
        failure_criteria=["Goal remains unclear"],
        gates=["before_run"],
        context_policy={"max_context_tokens": 4000},
        improvement_strategy="Review failed steps and revise prompts within budget.",
    )

    assert spec.status == "draft"
    assert spec.agents[0].name == "Planner"
    assert spec.tool_permissions[0].enabled is True


def test_run_status_includes_context_overflow() -> None:
    assert RunStatus.CONTEXT_OVERFLOW.value == "context_overflow"
