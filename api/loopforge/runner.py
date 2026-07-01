from __future__ import annotations

import json

from api.loopforge.agent_loop import AgentLoop, LoopHooks, LoopResult
from api.loopforge.context import ContextManager
from api.loopforge.domain import Artifact, ContextEntry, Evaluator, Gate, Goal, LoopSpec, Run, RunEvent, RunStatus, now_utc
from api.loopforge.evaluators import EvaluationCandidate, MlBaselineEvaluator, build_evaluator_provider
from api.loopforge.providers import DatasetMount, LLMProvider, SandboxProvider, SandboxResult
from api.loopforge.store import Store
from api.loopforge.tools import ToolRegistry


class LoopRunner:
    def __init__(
        self,
        *,
        store: Store,
        llm: LLMProvider,
        sandbox: SandboxProvider,
        tools: ToolRegistry,
        dataset_mount: DatasetMount | None = None,
        evaluator: Evaluator | None = None,
    ) -> None:
        self.store = store
        self.llm = llm
        self.sandbox = sandbox
        self.tools = tools
        self.dataset_mount = dataset_mount
        self.evaluator = evaluator

    def start(self, goal: Goal, spec: LoopSpec) -> Run:
        run = self.store.save_run(Run(goal_id=goal.id, loop_spec_id=spec.id, status=RunStatus.RUNNING, started_at=now_utc()))

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)

        context_manager = ContextManager(max_tokens=goal.budget.max_context_tokens)
        self.store.append_context(ContextEntry(run_id=run.id, kind="goal", text=goal.text, tags=["goal", "required"]))
        if self.dataset_mount is not None:
            self.store.append_context(ContextEntry(run_id=run.id, kind="dataset", text=f"Dataset mounted read-only at /workspace/data/{self.dataset_mount.filename}", tags=["dataset", "required"]))
        pack = context_manager.build_pack(self.store.list_context(run.id), task="execute approved loop", required_tags=["required"])
        if pack.overflow:
            run = run.model_copy(update={"status": RunStatus.CONTEXT_OVERFLOW, "ended_at": now_utc()})
            self.store.save_run(run)
            self._event(run, "run_status", "Context pack could not fit within budget", {"status": run.status})
            return run
        self._event(run, "node_start", "Executor started", {"agent": spec.agents[0].name, "context_tokens": pack.token_count})

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)
        if spec.gates:
            gate = self.store.save_gate(Gate(run_id=run.id, gate_type=spec.gates[0], context={"goal_id": goal.id, "loop_spec_id": spec.id, "message": "Run paused at configured approval gate."}))
            paused = run.model_copy(update={"status": RunStatus.PENDING_APPROVAL})
            self.store.save_run(paused)
            self._event(paused, "gate_pending", "Run is waiting for gate approval", {"gate_id": gate.id, "gate_type": gate.gate_type})
            self._event(paused, "run_status", "Run pending approval", {"status": paused.status})
            return paused

        return self._complete_execution(run, goal, spec, first_agent_started=True)

    def resume_after_gate(self, run: Run, goal: Goal, spec: LoopSpec) -> Run:
        running = run.model_copy(update={"status": RunStatus.RUNNING})
        self.store.save_run(running)
        if not self._consume_step(running, goal):
            return self._budget_exhausted(running)
        return self._complete_execution(running, goal, spec, first_agent_started=True)

    def _complete_execution(self, run: Run, goal: Goal, spec: LoopSpec, *, first_agent_started: bool) -> Run:
        agents = spec.agents[:1] if bool(getattr(self.llm, "offline_stub", False)) else spec.agents
        session = self.sandbox.open_session(dataset_mount=self.dataset_mount)
        evaluator_provider = build_evaluator_provider(self.evaluator, llm=self.llm, sandbox=self.sandbox)
        dataset_note = self._dataset_note()

        hooks = LoopHooks(
            consume_step=lambda: self._consume_step(run, goal),
            count_llm_call=lambda tokens: self._record_llm_call(run),
            emit=lambda event_type, message, payload: self._event(run, event_type, message, payload),
            on_code_run=lambda code, outcome: self._save_code_artifact(run, code, outcome),
        )

        prior_note = ""
        validated_any = False
        ran_any_code = False
        last_summary = ""

        for index, agent in enumerate(agents):
            if index > 0 or not first_agent_started:
                self._event(run, "node_start", "Agent started", {"agent": agent.name})

            remaining = goal.budget.max_steps - run.spent_steps
            if remaining <= 0:
                return self._budget_exhausted(run)

            loop = AgentLoop(llm=self.llm, session=session, hooks=hooks, max_turns=remaining)
            result = loop.run(
                agent=agent,
                goal_text=goal.text,
                success_criteria=spec.success_criteria,
                dataset_note=dataset_note,
                prior_note=prior_note,
            )
            ran_any_code = ran_any_code or result.ran_code

            if result.budget_exhausted:
                return self._budget_exhausted(run)
            if result.failure:
                return self._fail_run(run, result.failure)

            validated_any = self._persist_finish(run, result, evaluator_provider) or validated_any
            last_summary = result.summary or last_summary
            prior_note = (result.summary or "")[:1200]
            self._append_agent_context(run, agent.name, result)
            self._event(run, "cost_update", "Budget updated", {"spent_steps": run.spent_steps, "spent_llm_calls": run.spent_llm_calls})
            self._event(run, "node_end", "Agent completed", {"agent": agent.name})

        summary = last_summary or ("Loop completed." if ran_any_code else "Loop completed without executing any code.")
        completed = run.model_copy(update={"status": RunStatus.COMPLETED, "result_summary": summary[:500], "ended_at": now_utc()})
        self.store.save_run(completed)
        self._event(completed, "run_status", "Run completed", {"status": completed.status, "validated": validated_any})
        return completed

    def _dataset_note(self) -> str:
        if self.dataset_mount is None:
            return ""
        return f"A read-only dataset is mounted at /workspace/data/{self.dataset_mount.filename}."

    def _save_code_artifact(self, run: Run, code: str, outcome: SandboxResult) -> None:
        self.store.save_artifact(
            Artifact(
                run_id=run.id,
                kind="code",
                metadata={
                    "filename": "step.py",
                    "language": "python",
                    "content": code,
                    "exit_code": outcome.exit_code,
                    "stdout": (outcome.stdout or "")[:8000],
                    "stderr": (outcome.stderr or "")[:8000],
                },
            )
        )

    def _persist_finish(self, run: Run, result: LoopResult, evaluator_provider) -> bool:
        if not result.finished:
            return False
        if result.summary:
            self.store.save_artifact(Artifact(run_id=run.id, kind="report", metadata={"filename": "report.md", "content": result.summary, "summary": result.summary[:240]}))

        validated = False
        for insight in result.insights:
            candidate = EvaluationCandidate(metadata=insight, text=str(result.summary or ""))
            if evaluator_provider.evaluate(candidate).passed:
                validated = True
                self.store.save_artifact(Artifact(run_id=run.id, kind="insight", metadata={**insight, "passed": True}))
        for model in result.models:
            provider = evaluator_provider if self.evaluator is not None else MlBaselineEvaluator()
            candidate = EvaluationCandidate(metadata=model, text=str(result.summary or ""))
            if provider.evaluate(candidate).passed:
                validated = True
                self.store.save_artifact(Artifact(run_id=run.id, kind="model", metadata={**model, "beats_baseline": True, "leakage_ok": model.get("leakage_ok", True)}))
        return validated

    def _append_agent_context(self, run: Run, agent_name: str, result: LoopResult) -> None:
        summary: list[str] = []
        if result.summary:
            summary.append(result.summary[:1000])
        if result.models:
            summary.append(f"models={json.dumps(result.models)[:1000]}")
        if result.insights:
            summary.append(f"insights={json.dumps(result.insights)[:1000]}")
        if summary:
            self.store.append_context(ContextEntry(run_id=run.id, kind="agent_output", text=f"{agent_name}: " + "\n".join(summary), tags=["agent_output"]))

    def _record_llm_call(self, run: Run) -> None:
        updated = run.model_copy(update={"spent_llm_calls": run.spent_llm_calls + 1})
        self.store.save_run(updated)
        run.spent_llm_calls = updated.spent_llm_calls

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
        self._event(exhausted, "run_status", "Step budget exhausted", {"status": exhausted.status})
        return exhausted

    def _fail_run(self, run: Run, summary: str) -> Run:
        failed = run.model_copy(update={"status": RunStatus.FAILED, "result_summary": summary, "ended_at": now_utc()})
        self.store.save_run(failed)
        self._event(failed, "run_status", summary, {"status": failed.status})
        return failed

    def _event(self, run: Run, event_type: str, message: str, payload: dict[str, object] | None = None) -> None:
        self.store.append_event(RunEvent(run_id=run.id, seq=0, type=event_type, message=message, payload=payload or {}))
