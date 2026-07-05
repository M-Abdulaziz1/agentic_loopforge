"""Agent-engine abstraction.

LoopForge orchestrates guarded runs; the *engine* is what actually drives an
agent through reason→act→observe. This interface lets a run be executed either
by LoopForge's built-in ReAct loop (``NativeReActEngine``) or by an external
agent runtime such as opencode (``OpencodeEngine``) — selected per project —
without the runner, guardrails, evaluators, or HITL gates knowing which one is
in play. Nodes depend on the interface, never a concrete engine (CLAUDE.md:
"abstractions first").
"""
from __future__ import annotations

from typing import Protocol

from api.loopforge.agent_loop import AgentLoop, LoopHooks, LoopResult
from api.loopforge.domain import LoopSpecAgent
from api.loopforge.providers import LLMProvider, SandboxSession


class AgentEngine(Protocol):
    """Drives one agent for one turn over a shared workspace, under the run's budget."""

    def run(
        self,
        agent: LoopSpecAgent,
        *,
        goal_text: str,
        success_criteria: list[str],
        dataset_note: str,
        prior_note: str,
        session: SandboxSession,
        hooks: LoopHooks,
        max_turns: int,
    ) -> LoopResult:
        raise NotImplementedError


class NativeReActEngine:
    """LoopForge's own ReAct loop — the default engine."""

    def __init__(self, llm: LLMProvider) -> None:
        self.llm = llm

    def run(
        self,
        agent: LoopSpecAgent,
        *,
        goal_text: str,
        success_criteria: list[str],
        dataset_note: str,
        prior_note: str,
        session: SandboxSession,
        hooks: LoopHooks,
        max_turns: int,
    ) -> LoopResult:
        return AgentLoop(llm=self.llm, session=session, hooks=hooks, max_turns=max_turns).run(
            agent=agent,
            goal_text=goal_text,
            success_criteria=success_criteria,
            dataset_note=dataset_note,
            prior_note=prior_note,
        )
