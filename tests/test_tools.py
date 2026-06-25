import pytest

from api.loopforge.domain import GoalMode, GoalToggles
from api.loopforge.tools import ToolRegistry, ToolSpec, ToolUnavailableError


def test_offline_mode_blocks_internet_tool() -> None:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="web_search", requires_internet=True))

    with pytest.raises(ToolUnavailableError, match="internet"):
        registry.require_available(
            "web_search",
            mode=GoalMode.OFFLINE_LOCAL,
            toggles=GoalToggles(internet=False),
            allowed_tools=["web_search"],
        )


def test_goal_toggle_allows_online_tool_when_spec_allows_it() -> None:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="web_search", requires_internet=True))

    tool = registry.require_available(
        "web_search",
        mode=GoalMode.ONLINE_ENABLED,
        toggles=GoalToggles(internet=True),
        allowed_tools=["web_search"],
    )

    assert tool.name == "web_search"


def test_loop_spec_allowlist_blocks_unlisted_tool() -> None:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="code_sandbox", requires_sandbox=True))

    with pytest.raises(ToolUnavailableError, match="not allowed"):
        registry.require_available(
            "code_sandbox",
            mode=GoalMode.OFFLINE_LOCAL,
            toggles=GoalToggles(code_sandbox=True),
            allowed_tools=[],
        )
