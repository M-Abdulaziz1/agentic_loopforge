from __future__ import annotations

from dataclasses import dataclass

from api.loopforge.domain import (
    ClarificationQuestion,
    ClarificationSession,
    Goal,
    GoalMode,
    LoopSpec,
    StoredDataset,
    LoopSpecAgent,
    RunStatus,
    ToolPermission,
)
from api.loopforge.providers import LLMProvider


@dataclass(frozen=True)
class ClarityResult:
    status: RunStatus
    session: ClarificationSession | None = None


class LoopPlanner:
    def __init__(self, llm: LLMProvider) -> None:
        self.llm = llm

    def check_clarity(self, goal: Goal) -> ClarityResult:
        missing = self._missing_requirements(goal.text)
        if missing:
            questions = [
                ClarificationQuestion(
                    question="What specific outcome should the loop produce?",
                    missing_requirement=missing[0],
                )
            ]
            session = ClarificationSession(
                goal_id=goal.id,
                questions=questions,
                missing_requirements=missing,
                clarity_score=0.35,
            )
            return ClarityResult(status=RunStatus.NEEDS_CLARIFICATION, session=session)
        return ClarityResult(status=RunStatus.PENDING_APPROVAL)

    def generate_spec(self, goal: Goal, dataset: StoredDataset | None = None) -> LoopSpec:
        self.llm.complete(system="loop-planner", prompt=_planner_prompt(goal, dataset))
        permissions = [
            ToolPermission(tool_name="local_workspace", enabled=True, reason="Store run artifacts"),
            ToolPermission(tool_name="code_sandbox", enabled=goal.toggles.code_sandbox, reason="Run generated code safely"),
        ]
        if goal.mode == GoalMode.ONLINE_ENABLED and goal.toggles.internet:
            permissions.append(ToolPermission(tool_name="web_search", enabled=True, reason="Internet toggle enabled"))
        else:
            permissions.append(ToolPermission(tool_name="web_search", enabled=False, reason="Internet disabled for this goal"))

        allowed_tools = [permission.tool_name for permission in permissions if permission.enabled]
        return LoopSpec(
            goal_id=goal.id,
            version=1,
            agents=[
                LoopSpecAgent(
                    name="Loop Planner",
                    role="Maintain the plan, validate progress, and coordinate agents.",
                    system_prompt="You convert the approved goal into small executable steps and keep the run aligned with constraints.",
                    tools=["local_workspace"],
                ),
                LoopSpecAgent(
                    name="Executor",
                    role="Use approved tools to produce artifacts that satisfy the goal.",
                    system_prompt="You execute only approved steps with approved tools and report blockers honestly.",
                    tools=allowed_tools,
                ),
                LoopSpecAgent(
                    name="Reviewer",
                    role="Check whether the output satisfies the success criteria.",
                    system_prompt="You compare outputs against success and failure criteria, then recommend improve or finalize.",
                    tools=["local_workspace"],
                ),
            ],
            tool_permissions=permissions,
            handoffs=[
                {"from": "Loop Planner", "to": "Executor", "condition": "plan ready"},
                {"from": "Executor", "to": "Reviewer", "condition": "artifact produced"},
            ],
            success_criteria=[f"Produce a result that directly satisfies: {goal.text}"],
            failure_criteria=["Required permission is missing", "Goal cannot be achieved within budget"],
            gates=["before_run"],
            context_policy={"max_context_tokens": goal.budget.max_context_tokens},
            improvement_strategy="If review fails, revise the plan once within budget and retry the weakest step.",
        )

    def _missing_requirements(self, text: str) -> list[str]:
        normalized = text.strip().lower()
        vague_phrases = {"make it better", "help me", "do the thing", "improve this"}
        if normalized in vague_phrases or len(normalized.split()) < 6:
            return ["desired outcome", "success criteria"]
        return []


def _planner_prompt(goal: Goal, dataset: StoredDataset | None) -> str:
    if dataset is None:
        return goal.text
    profile = dataset.profile.model_dump() if dataset.profile is not None else None
    return (
        f"{goal.text}\n\n"
        "Dataset available for this goal. Use only this masked profile for planning; "
        "raw dataset values are mounted later in the sandbox.\n"
        f"Dataset filename: {dataset.filename}\n"
        f"Dataset kind: {dataset.kind}\n"
        f"Masked profile: {profile}"
    )
