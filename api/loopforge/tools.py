from __future__ import annotations

from dataclasses import dataclass

from api.loopforge.domain import GoalMode, GoalToggles


class ToolUnavailableError(ValueError):
    pass


@dataclass(frozen=True)
class ToolSpec:
    name: str
    requires_internet: bool = False
    requires_sandbox: bool = False
    description: str = ""


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolSpec] = {}

    def register(self, tool: ToolSpec) -> None:
        self._tools[tool.name] = tool

    def require_available(
        self,
        name: str,
        *,
        mode: GoalMode,
        toggles: GoalToggles,
        allowed_tools: list[str],
    ) -> ToolSpec:
        if name not in self._tools:
            raise ToolUnavailableError(f"Tool {name} is not registered")
        if name not in allowed_tools:
            raise ToolUnavailableError(f"Tool {name} is not allowed by the loop spec")

        tool = self._tools[name]
        if tool.requires_internet and (mode != GoalMode.ONLINE_ENABLED or not toggles.internet):
            raise ToolUnavailableError(f"Tool {name} requires internet access")
        if tool.requires_sandbox and not toggles.code_sandbox:
            raise ToolUnavailableError(f"Tool {name} requires code sandbox access")
        return tool


def default_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="local_workspace", description="Read and write managed workspace files"))
    registry.register(ToolSpec(name="code_sandbox", requires_sandbox=True, description="Run code in gVisor sandbox"))
    registry.register(ToolSpec(name="web_search", requires_internet=True, description="Search the web when enabled"))
    return registry
