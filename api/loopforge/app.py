from __future__ import annotations

import asyncio
import json
import sqlite3

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from api.loopforge.domain import (
    ClarificationAnswer,
    ClarificationResult,
    ClarificationSession,
    ClarificationStatus,
    Gate,
    GateDecision,
    GateStatus,
    Goal,
    GoalCreate,
    GoalCreateResult,
    LoopSpec,
    LoopSpecUpdate,
    Run,
    RunEvent,
    RunStartRequest,
    RunStatus,
    now_utc,
)
from api.loopforge.planner import LoopPlanner
from api.loopforge.runner import LoopRunner
from api.loopforge.runtime import create_llm_provider, create_sandbox_provider
from api.loopforge.settings import Settings
from api.loopforge.sqlite_store import SQLiteStore
from api.loopforge.store import InMemoryStore, Store
from api.loopforge.tools import default_tool_registry


def create_store(settings: Settings) -> Store:
    try:
        return SQLiteStore(settings.storage_path)
    except (OSError, sqlite3.Error):
        if settings.storage_path != Settings().storage_path:
            raise
        return InMemoryStore()


def create_app(store: Store | None = None, settings: Settings | None = None) -> FastAPI:
    app = FastAPI(title="LoopForge")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    settings = settings or Settings()
    store = store or InMemoryStore()
    llm = create_llm_provider(settings)
    planner = LoopPlanner(llm=llm)
    sandbox = create_sandbox_provider(settings)
    tools = default_tool_registry()

    @app.get("/api/goals")
    def list_goals() -> list[Goal]:
        return store.list_goals()

    @app.post("/api/goals", status_code=201)
    def create_goal(payload: GoalCreate) -> GoalCreateResult:
        goal = store.save_goal(Goal(**payload.model_dump()))
        clarity = planner.check_clarity(goal)
        goal = goal.model_copy(update={"status": clarity.status})
        store.save_goal(goal)
        if clarity.session is not None:
            session = store.save_clarification(clarity.session)
            return GoalCreateResult(goal=goal, clarification=session, loop_spec=None)

        spec = store.save_loop_spec(planner.generate_spec(goal))
        return GoalCreateResult(goal=goal, clarification=None, loop_spec=spec)

    @app.get("/api/goals/{goalId}")
    def get_goal(goalId: str) -> Goal:
        try:
            return store.get_goal(goalId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Goal not found") from exc

    @app.get("/api/goals/{goalId}/clarification")
    def get_clarification(goalId: str) -> ClarificationSession:
        try:
            return store.get_clarification_by_goal(goalId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Clarification session not found") from exc

    @app.post("/api/goals/{goalId}/clarification/answers")
    def submit_clarification_answer(goalId: str, payload: ClarificationAnswer) -> ClarificationResult:
        try:
            goal = store.get_goal(goalId)
            session = store.get_clarification_by_goal(goalId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Goal or clarification session not found") from exc

        question_ids = {question.id for question in session.questions}
        if payload.question_id not in question_ids:
            raise HTTPException(status_code=404, detail="Clarification question not found")

        answers = [*session.answers, {"question_id": payload.question_id, "answer": payload.answer}]
        answered_question_ids = {answer["question_id"] for answer in answers if answer["answer"].strip()}
        all_questions_answered = question_ids.issubset(answered_question_ids)
        clarity_threshold_met = len(payload.answer.strip().split()) >= 6
        if all_questions_answered or clarity_threshold_met:
            session = session.model_copy(
                update={
                    "answers": answers,
                    "missing_requirements": [],
                    "clarity_score": 1.0,
                    "status": ClarificationStatus.READY,
                }
            )
            goal = goal.model_copy(update={"status": RunStatus.PENDING_APPROVAL})
            store.save_goal(goal)
            store.save_clarification(session)
            spec = store.save_loop_spec(planner.generate_spec(goal))
            return ClarificationResult(clarification=session, loop_spec=spec)

        session = session.model_copy(update={"answers": answers, "clarity_score": 0.55})
        store.save_clarification(session)
        return ClarificationResult(clarification=session, loop_spec=None)

    @app.get("/api/loop-specs")
    def list_loop_specs(goal_id: str | None = None) -> list[LoopSpec]:
        return store.list_loop_specs(goal_id=goal_id)

    @app.get("/api/loop-specs/{specId}")
    def get_loop_spec(specId: str) -> LoopSpec:
        try:
            return store.get_loop_spec(specId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Loop spec not found") from exc

    @app.patch("/api/loop-specs/{specId}")
    def update_loop_spec(specId: str, payload: LoopSpecUpdate) -> LoopSpec:
        try:
            spec = store.get_loop_spec(specId)
            goal = store.get_goal(spec.goal_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Loop spec not found") from exc

        update = payload.model_dump(exclude_unset=True)
        candidate = LoopSpec(**{**spec.model_dump(), **update, "version": spec.version + 1})
        _validate_loop_spec(goal, candidate)
        return store.save_loop_spec(candidate)

    @app.post("/api/loop-specs/{specId}/approve")
    def approve_loop_spec(specId: str) -> LoopSpec:
        try:
            spec = store.get_loop_spec(specId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Loop spec not found") from exc
        if spec.status != "draft":
            raise HTTPException(status_code=409, detail="Loop spec is not in an approvable state")
        approved = spec.model_copy(update={"status": "approved"})
        return store.save_loop_spec(approved)

    @app.post("/api/goals/{goalId}/runs", status_code=201)
    def start_run(goalId: str, payload: RunStartRequest) -> Run:
        try:
            goal = store.get_goal(goalId)
            spec = store.get_loop_spec(payload.loop_spec_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Goal or loop spec not found") from exc
        if spec.goal_id != goal.id:
            raise HTTPException(status_code=404, detail="Goal or loop spec not found")
        if spec.status != "approved":
            raise HTTPException(status_code=409, detail="Loop spec must be approved before running")
        runner = LoopRunner(store=store, llm=llm, sandbox=sandbox, tools=tools)
        return runner.start(goal, spec)

    @app.get("/api/runs")
    def list_runs() -> list[Run]:
        return store.list_runs()

    @app.get("/api/runs/{runId}")
    def get_run(runId: str) -> Run:
        try:
            return store.get_run(runId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc

    @app.post("/api/runs/{runId}/cancel")
    def cancel_run(runId: str) -> Run:
        try:
            run = store.get_run(runId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc
        cancelled = run.model_copy(update={"status": RunStatus.CANCELLED, "ended_at": now_utc()})
        store.save_run(cancelled)
        _append_run_status_event(store, cancelled, "Run cancelled", {"status": cancelled.status})
        return cancelled

    @app.post("/api/runs/{runId}/pause")
    def pause_run(runId: str) -> Run:
        try:
            run = store.get_run(runId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc
        paused = run.model_copy(update={"status": RunStatus.PENDING_APPROVAL})
        store.save_run(paused)
        _append_run_status_event(store, paused, "Run paused", {"status": paused.status, "reason": "paused"})
        return paused

    @app.get("/api/runs/{runId}/events")
    def stream_run_events(runId: str, request: Request):
        try:
            store.get_run(runId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc

        accept = request.headers.get("accept", "")
        if "application/json" in accept:
            return [event.model_dump(mode="json") for event in store.list_events(runId)]

        async def event_stream():
            last_seq = 0
            while True:
                events = [event for event in store.list_events(runId) if event.seq > last_seq]
                for event in events:
                    last_seq = event.seq
                    yield f"data: {json.dumps(event.model_dump(mode='json'))}\n\n"
                run = store.get_run(runId)
                if _is_terminal(run.status):
                    break
                await asyncio.sleep(0.1)

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    @app.get("/api/gates")
    def list_gates(status: GateStatus | None = None, run_id: str | None = None) -> list[Gate]:
        return store.list_gates(status=status, run_id=run_id)

    @app.post("/api/gates/{gateId}/decision")
    def decide_gate(gateId: str, payload: GateDecision) -> Gate:
        try:
            gate = store.get_gate(gateId)
            run = store.get_run(gate.run_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Gate not found") from exc
        if gate.status != GateStatus.PENDING:
            raise HTTPException(status_code=409, detail="Gate already decided")

        status = GateStatus.APPROVED if payload.decision == "approve" else GateStatus.REJECTED
        decided = gate.model_copy(update={"status": status, "note": payload.note})
        store.save_gate(decided)

        if status == GateStatus.REJECTED:
            updated_run = run.model_copy(update={"status": RunStatus.CANCELLED, "ended_at": now_utc()})
            store.save_run(updated_run)
            _append_run_status_event(store, updated_run, "Gate rejected; run cancelled", {"status": updated_run.status, "gate_id": gate.id})
            return decided

        if all(existing.status == GateStatus.APPROVED for existing in store.list_gates(run_id=run.id)):
            try:
                goal = store.get_goal(run.goal_id)
                spec = store.get_loop_spec(run.loop_spec_id)
            except KeyError as exc:
                raise HTTPException(status_code=404, detail="Run goal or loop spec not found") from exc
            runner = LoopRunner(store=store, llm=llm, sandbox=sandbox, tools=tools)
            runner.resume_after_gate(run, goal, spec)
        return decided

    return app


def _validate_loop_spec(goal: Goal, spec: LoopSpec) -> None:
    if not spec.agents:
        raise HTTPException(status_code=422, detail="Loop spec must include at least one agent")

    enabled_tools = {permission.tool_name for permission in spec.tool_permissions if permission.enabled}
    agent_tools = {tool for agent in spec.agents for tool in agent.tools}
    requested_tools = enabled_tools | agent_tools

    if not goal.toggles.internet and "web_search" in requested_tools:
        raise HTTPException(status_code=422, detail="Tool web_search requires internet access")
    if not goal.toggles.code_sandbox and "code_sandbox" in requested_tools:
        raise HTTPException(status_code=422, detail="Tool code_sandbox requires code sandbox access")

    agent_names = {agent.name for agent in spec.agents}
    for handoff in spec.handoffs:
        source = handoff.get("from")
        target = handoff.get("to")
        if source is not None and source not in agent_names:
            raise HTTPException(status_code=422, detail=f"Handoff source agent not found: {source}")
        if target is not None and target not in agent_names:
            raise HTTPException(status_code=422, detail=f"Handoff target agent not found: {target}")


def _append_run_status_event(store: Store, run: Run, message: str, payload: dict[str, object]) -> RunEvent:
    return store.append_event(
        RunEvent(
            run_id=run.id,
            seq=0,
            type="run_status",
            message=message,
            payload=payload,
        )
    )


def _is_terminal(status: RunStatus) -> bool:
    return status in {
        RunStatus.COMPLETED,
        RunStatus.BUDGET_EXHAUSTED,
        RunStatus.FAILED,
        RunStatus.CANCELLED,
        RunStatus.UNSAFE_REQUEST,
        RunStatus.CONTEXT_OVERFLOW,
    }


_settings = Settings.from_env()
app = create_app(store=create_store(_settings), settings=_settings)
