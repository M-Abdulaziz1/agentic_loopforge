from __future__ import annotations

from api.loopforge.context import ContextManager
from api.loopforge.domain import ContextEntry, Goal, LoopSpec, Run, RunEvent, RunStatus, now_utc
from api.loopforge.providers import LLMProvider, SandboxProvider
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import ToolRegistry


class LoopRunner:
    def __init__(
        self,
        *,
        store: InMemoryStore,
        llm: LLMProvider,
        sandbox: SandboxProvider,
        tools: ToolRegistry,
    ) -> None:
        self.store = store
        self.llm = llm
        self.sandbox = sandbox
        self.tools = tools

    def start(self, goal: Goal, spec: LoopSpec) -> Run:
        run = self.store.save_run(
            Run(
                goal_id=goal.id,
                loop_spec_id=spec.id,
                status=RunStatus.RUNNING,
                started_at=now_utc(),
            )
        )
        self._event(run, "run_started", "Run started")

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)

        context_manager = ContextManager(max_tokens=goal.budget.max_context_tokens)
        self.store.append_context(ContextEntry(run_id=run.id, kind="goal", text=goal.text, tags=["goal", "required"]))
        pack = context_manager.build_pack(
            self.store.list_context(run.id),
            task="execute approved loop",
            required_tags=["required"],
        )
        if pack.overflow:
            run = run.model_copy(update={"status": RunStatus.CONTEXT_OVERFLOW, "ended_at": now_utc()})
            self.store.save_run(run)
            self._event(run, "context_overflow", "Context pack could not fit within budget")
            return run
        self._event(run, "context_pack", "Context pack built", {"tokens": pack.token_count})

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)
        response = self.llm.complete(system=spec.agents[0].system_prompt, prompt=goal.text)
        run = run.model_copy(update={"spent_llm_calls": run.spent_llm_calls + 1})
        self.store.save_run(run)
        self._event(run, "agent_step", "Executor produced an artifact", {"tokens": response.tokens_used})

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)
        self._event(run, "review", "Reviewer accepted deterministic result")

        completed = run.model_copy(
            update={
                "status": RunStatus.COMPLETED,
                "result_summary": "Loop completed with deterministic fake providers.",
                "ended_at": now_utc(),
            }
        )
        self.store.save_run(completed)
        self._event(completed, "run_completed", "Run completed")
        return completed

    def _consume_step(self, run: Run, goal: Goal) -> bool:
        if run.spent_steps >= goal.budget.max_steps:
            return False
        updated = run.model_copy(update={"spent_steps": run.spent_steps + 1})
        self.store.save_run(updated)
        run.spent_steps = updated.spent_steps
        return True

    def _budget_exhausted(self, run: Run) -> Run:
        exhausted = run.model_copy(update={"status": RunStatus.BUDGET_EXHAUSTED, "ended_at": now_utc()})
        self.store.save_run(exhausted)
        self._event(exhausted, "budget_exhausted", "Step budget exhausted")
        return exhausted

    def _event(self, run: Run, event_type: str, message: str, payload: dict[str, object] | None = None) -> None:
        self.store.append_event(
            RunEvent(
                run_id=run.id,
                seq=0,
                type=event_type,
                message=message,
                payload=payload or {},
            )
        )
