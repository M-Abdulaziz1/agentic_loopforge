from __future__ import annotations

from fastapi import FastAPI, HTTPException

from api.loopforge.domain import Goal, GoalCreate, LoopSpec, Run
from api.loopforge.planner import LoopPlanner
from api.loopforge.providers import FakeLLMProvider, FakeSandboxProvider
from api.loopforge.runner import LoopRunner
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import default_tool_registry


def create_app() -> FastAPI:
    app = FastAPI(title="LoopForge")
    store = InMemoryStore()
    llm = FakeLLMProvider()
    planner = LoopPlanner(llm=llm)
    sandbox = FakeSandboxProvider()
    tools = default_tool_registry()

    @app.post("/api/goals", status_code=201)
    def create_goal(payload: GoalCreate) -> dict[str, object]:
        goal = store.save_goal(Goal(**payload.model_dump()))
        clarity = planner.check_clarity(goal)
        goal = goal.model_copy(update={"status": clarity.status})
        store.save_goal(goal)
        response: dict[str, object] = {"goal": goal}
        if clarity.session is not None:
            response["clarification"] = clarity.session
            return response

        spec = store.save_loop_spec(planner.generate_spec(goal))
        response["loop_spec"] = spec
        return response

    @app.post("/api/loop-specs/{spec_id}/approve")
    def approve_loop_spec(spec_id: str) -> LoopSpec:
        try:
            spec = store.get_loop_spec(spec_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Loop spec not found") from exc
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


app = create_app()
