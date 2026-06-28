from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api.loopforge.domain import (
    ClarificationAnswer,
    ClarificationResult,
    ClarificationSession,
    ClarificationStatus,
    Goal,
    GoalCreate,
    GoalCreateResult,
    LoopSpec,
    LoopSpecUpdate,
    Run,
    RunStatus,
)
from api.loopforge.planner import LoopPlanner
from api.loopforge.providers import FakeLLMProvider, FakeSandboxProvider
from api.loopforge.runner import LoopRunner
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import default_tool_registry


def create_app() -> FastAPI:
    app = FastAPI(title="LoopForge")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    store = InMemoryStore()
    llm = FakeLLMProvider()
    planner = LoopPlanner(llm=llm)
    sandbox = FakeSandboxProvider()
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
        if len(payload.answer.strip().split()) >= 6:
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

    @app.post("/api/goals/{goal_id}/runs", status_code=201)
    def start_run(goal_id: str, payload: dict[str, str]) -> Run:
        try:
            goal = store.get_goal(goal_id)
            spec = store.get_loop_spec(payload["loop_spec_id"])
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Goal or loop spec not found") from exc
        if spec.status != "approved":
            raise HTTPException(status_code=409, detail="Loop spec must be approved before running")
        runner = LoopRunner(store=store, llm=llm, sandbox=sandbox, tools=tools)
        return runner.start(goal, spec)

    @app.get("/api/runs/{run_id}/events")
    def list_run_events(run_id: str) -> list[dict[str, object]]:
        return [event.model_dump(mode="json") for event in store.list_events(run_id)]

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


app = create_app()
