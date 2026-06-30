from api.loopforge.domain import Goal, GoalMode, GoalToggles, RunStatus
from api.loopforge.planner import LoopPlanner
from api.loopforge.providers import FakeLLMProvider


def test_planner_requests_clarification_for_vague_goal() -> None:
    planner = LoopPlanner(llm=FakeLLMProvider())
    goal = Goal(text="make it better")

    result = planner.check_clarity(goal)

    assert result.status == RunStatus.NEEDS_CLARIFICATION
    assert result.session is not None
    assert result.session.missing_requirements == ["desired outcome", "success criteria"]
    assert result.session.questions[0].question.endswith("?")


def test_planner_generates_loop_spec_for_clear_offline_goal() -> None:
    planner = LoopPlanner(llm=FakeLLMProvider())
    goal = Goal(
        text="Create a three-step launch checklist for a local-only developer tool and save the result",
        mode=GoalMode.OFFLINE_LOCAL,
        toggles=GoalToggles(internet=False, code_sandbox=True),
    )

    result = planner.check_clarity(goal)
    spec = planner.generate_spec(goal)

    assert result.status == RunStatus.PENDING_APPROVAL
    assert spec.goal_id == goal.id
    assert spec.agents[0].name == "Loop Planner"
    assert "web_search" not in [permission.tool_name for permission in spec.tool_permissions if permission.enabled]
    assert spec.gates == ["before_training", "before_finalize"]


def test_planner_includes_web_tool_when_internet_toggle_is_enabled() -> None:
    planner = LoopPlanner(llm=FakeLLMProvider())
    goal = Goal(
        text="Research current pricing pages online and summarize positioning",
        mode=GoalMode.ONLINE_ENABLED,
        toggles=GoalToggles(internet=True),
    )

    spec = planner.generate_spec(goal)

    enabled_tools = [permission.tool_name for permission in spec.tool_permissions if permission.enabled]
    assert "web_search" in enabled_tools
