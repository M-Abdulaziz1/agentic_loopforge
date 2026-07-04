from __future__ import annotations

import asyncio
import json
from pathlib import Path
import re
import shutil
import sqlite3

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from api.loopforge.domain import (
    Artifact,
    AuditEvent,
    ClarificationAnswer,
    ClarificationResult,
    ClarificationSession,
    ClarificationStatus,
    ContextEntry,
    ContextPack,
    Dataset,
    DatasetKind,
    DatasetStatus,
    Evaluator,
    EvaluatorCreate,
    EvaluatorUpdate,
    ArtifactContent,
    Gate,
    GateDecision,
    GateStatus,
    Goal,
    GoalCreate,
    GoalCreateResult,
    InsightResult,
    LLMProvider as LLMProviderView,
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMTestResult,
    LoopSpec,
    LoopSpecUpdate,
    LoopTemplate,
    LoopTemplateCreate,
    LoopTemplateInstantiate,
    ModelResult,
    Results,
    ResultsSummary,
    Run,
    RunContext,
    RunEvent,
    RunStartRequest,
    RunStatus,
    StoredDataset,
    StoredLLMProvider,
    now_utc,
)
from api.loopforge.context import ContextManager
from api.loopforge.datasets import parse_multipart_upload, profile_csv, safe_dataset_filename
from api.loopforge.planner import LoopPlanner, PlannerError
from api.loopforge.runner import LoopRunner
from api.loopforge.providers import DatasetMount, LLMProviderError
from api.loopforge.runtime import create_agent_engine, create_execution_sandbox_provider, create_llm_provider, create_llm_provider_from_config
from api.loopforge.secrets import SecretCipher
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
    secret_cipher = SecretCipher(settings.secret_key)
    tools = default_tool_registry()

    @app.get("/api/goals")
    def list_goals() -> list[Goal]:
        return store.list_goals()

    @app.post("/api/goals", status_code=201)
    def create_goal(payload: GoalCreate) -> GoalCreateResult:
        if payload.dataset_id is not None:
            try:
                store.get_dataset(payload.dataset_id)
            except KeyError as exc:
                raise HTTPException(status_code=404, detail="Dataset not found") from exc
        if payload.evaluator_id is not None:
            try:
                store.get_evaluator(payload.evaluator_id)
            except KeyError as exc:
                raise HTTPException(status_code=404, detail="Evaluator not found") from exc
        goal = store.save_goal(Goal(**payload.model_dump()))
        planner = LoopPlanner(llm=_llm_for_goal(store, settings, goal))
        try:
            clarity = planner.check_clarity(goal)
        except (PlannerError, LLMProviderError) as exc:
            raise _planner_http_error(exc, settings) from exc
        goal = goal.model_copy(update={"status": clarity.status})
        store.save_goal(goal)
        if clarity.session is not None:
            session = store.save_clarification(clarity.session)
            _audit(store, "goal.create", "goal", goal.id, {"status": goal.status})
            return GoalCreateResult(goal=goal, clarification=session, loop_spec=None)

        try:
            spec = store.save_loop_spec(planner.generate_spec(goal, dataset=_dataset_for_goal(store, goal)))
        except (PlannerError, LLMProviderError) as exc:
            raise _planner_http_error(exc, settings) from exc
        _audit(store, "goal.create", "goal", goal.id, {"status": goal.status, "loop_spec_id": spec.id})
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
        answered_in_scope = answered_question_ids & question_ids
        # The session is only ready once EVERY question has its own answer — one answer
        # never finalizes the others (no word-count shortcut).
        all_questions_answered = question_ids.issubset(answered_question_ids)
        if all_questions_answered:
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
            planner = LoopPlanner(llm=_llm_for_goal(store, settings, goal))
            try:
                spec = store.save_loop_spec(planner.generate_spec(goal, dataset=_dataset_for_goal(store, goal)))
            except (PlannerError, LLMProviderError) as exc:
                raise _planner_http_error(exc, settings) from exc
            return ClarificationResult(clarification=session, loop_spec=spec)

        progress = len(answered_in_scope) / len(question_ids) if question_ids else 1.0
        remaining = [q.missing_requirement for q in session.questions if q.id not in answered_question_ids]
        session = session.model_copy(
            update={"answers": answers, "clarity_score": progress, "missing_requirements": remaining}
        )
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
        approved = store.save_loop_spec(approved)
        _audit(store, "loop_spec.approve", "loop_spec", spec.id, {"goal_id": spec.goal_id})
        return approved

    @app.get("/api/templates")
    def list_templates() -> list[LoopTemplate]:
        return store.list_templates()

    @app.post("/api/templates", status_code=201)
    def create_template(payload: LoopTemplateCreate) -> LoopTemplate:
        try:
            spec = store.get_loop_spec(payload.spec_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Loop spec not found") from exc

        template = LoopTemplate(
            name=payload.name,
            description=payload.description,
            agents=spec.agents,
            tool_permissions=spec.tool_permissions,
            handoffs=spec.handoffs,
            success_criteria=spec.success_criteria,
            failure_criteria=spec.failure_criteria,
            gates=spec.gates,
            context_policy=spec.context_policy,
            improvement_strategy=spec.improvement_strategy,
        )
        saved = store.save_template(template)
        _audit(store, "template.create", "template", saved.id, {"spec_id": payload.spec_id})
        return saved

    @app.post("/api/templates/{templateId}/instantiate", status_code=201)
    def instantiate_template(templateId: str, payload: LoopTemplateInstantiate) -> LoopSpec:
        try:
            template = store.get_template(templateId)
            goal = store.get_goal(payload.goal_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Template or goal not found") from exc

        spec = LoopSpec(
            goal_id=goal.id,
            version=1,
            agents=template.agents,
            tool_permissions=template.tool_permissions,
            handoffs=template.handoffs,
            success_criteria=template.success_criteria,
            failure_criteria=template.failure_criteria,
            gates=template.gates,
            context_policy=template.context_policy,
            improvement_strategy=template.improvement_strategy,
            status="draft",
        )
        _validate_loop_spec(goal, spec)
        saved = store.save_loop_spec(spec)
        _audit(store, "template.instantiate", "template", template.id, {"goal_id": goal.id, "loop_spec_id": saved.id})
        return saved

    @app.delete("/api/templates/{templateId}", status_code=204)
    def delete_template(templateId: str) -> None:
        try:
            store.delete_template(templateId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Template not found") from exc
        _audit(store, "template.delete", "template", templateId, {})
        return None

    @app.get("/api/llm-providers")
    def list_llm_providers() -> list[LLMProviderView]:
        return [_public_llm_provider(provider) for provider in store.list_llm_providers()]

    @app.post("/api/llm-providers", status_code=201)
    def create_llm_provider_record(payload: LLMProviderCreate) -> LLMProviderView:
        provider = StoredLLMProvider(
            name=payload.name,
            kind=payload.kind,
            base_url=payload.base_url,
            model=payload.model,
            encrypted_api_key=secret_cipher.encrypt(payload.api_key),
            timeout_seconds=payload.timeout_seconds,
            is_default=payload.is_default,
        )
        saved = store.save_llm_provider(provider)
        _audit(store, "llm_provider.create", "llm_provider", saved.id, {"kind": saved.kind, "model": saved.model, "is_default": saved.is_default})
        return _public_llm_provider(saved)

    @app.get("/api/llm-providers/{providerId}")
    def get_llm_provider_record(providerId: str) -> LLMProviderView:
        try:
            return _public_llm_provider(store.get_llm_provider(providerId))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="LLM provider not found") from exc

    @app.patch("/api/llm-providers/{providerId}")
    def update_llm_provider_record(providerId: str, payload: LLMProviderUpdate) -> LLMProviderView:
        try:
            provider = store.get_llm_provider(providerId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="LLM provider not found") from exc

        update = payload.model_dump(exclude_unset=True)
        if "api_key" in update:
            update["encrypted_api_key"] = secret_cipher.encrypt(update.pop("api_key"))
        saved = store.save_llm_provider(provider.model_copy(update=update))
        _audit(store, "llm_provider.update", "llm_provider", saved.id, {"is_default": saved.is_default})
        return _public_llm_provider(saved)

    @app.delete("/api/llm-providers/{providerId}", status_code=204)
    def delete_llm_provider_record(providerId: str) -> None:
        try:
            store.delete_llm_provider(providerId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="LLM provider not found") from exc
        _audit(store, "llm_provider.delete", "llm_provider", providerId, {})
        return None

    @app.post("/api/llm-providers/{providerId}/test")
    def test_llm_provider_record(providerId: str) -> LLMTestResult:
        try:
            provider = store.get_llm_provider(providerId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="LLM provider not found") from exc
        try:
            llm_to_test = create_llm_provider_from_config(provider, settings)
            llm_to_test.complete(system="loopforge-provider-test", prompt="Reply with OK.")
        except LLMProviderError as exc:
            return LLMTestResult(ok=False, detail=_sanitize_provider_detail(str(exc), provider, settings), model=provider.model)
        except Exception as exc:
            return LLMTestResult(ok=False, detail=_sanitize_provider_detail(str(exc), provider, settings), model=provider.model)
        return LLMTestResult(ok=True, detail="Provider test succeeded", model=provider.model)

    @app.get("/api/datasets")
    def list_datasets() -> list[Dataset]:
        return [_public_dataset(dataset) for dataset in store.list_datasets()]

    @app.post("/api/datasets", status_code=201)
    async def upload_dataset(request: Request) -> Dataset:
        upload = _parse_dataset_request(request.headers.get("content-type", ""), await request.body())
        filename = safe_dataset_filename(upload.filename)
        kind = _dataset_kind(filename)
        if kind is None:
            raise HTTPException(status_code=415, detail="Only CSV and Parquet datasets are supported")
        if len(upload.content) > settings.dataset_max_size_bytes:
            raise HTTPException(status_code=413, detail="Dataset exceeds the configured size limit")

        dataset = StoredDataset(
            name=upload.name or filename,
            filename=filename,
            kind=kind,
            size_bytes=len(upload.content),
            storage_path="",
        )
        dataset_dir = Path(settings.dataset_storage_path) / dataset.id
        dataset_dir.mkdir(parents=True, exist_ok=False)
        storage_path = dataset_dir / filename
        storage_path.write_bytes(upload.content)
        dataset = dataset.model_copy(update={"storage_path": str(storage_path), "status": DatasetStatus.PROFILING})
        dataset = _profile_dataset(dataset)
        saved = store.save_dataset(dataset)
        _audit(store, "dataset.create", "dataset", saved.id, {"filename": saved.filename, "kind": saved.kind, "size_bytes": saved.size_bytes})
        return _public_dataset(saved)

    @app.get("/api/datasets/{datasetId}")
    def get_dataset(datasetId: str) -> Dataset:
        try:
            return _public_dataset(store.get_dataset(datasetId))
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Dataset not found") from exc

    @app.delete("/api/datasets/{datasetId}", status_code=204)
    def delete_dataset(datasetId: str) -> None:
        try:
            dataset = store.delete_dataset(datasetId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Dataset not found") from exc
        shutil.rmtree(Path(dataset.storage_path).parent, ignore_errors=True)
        _audit(store, "dataset.delete", "dataset", datasetId, {})
        return None

    @app.get("/api/evaluators")
    def list_evaluators() -> list[Evaluator]:
        return store.list_evaluators()

    @app.post("/api/evaluators", status_code=201)
    def create_evaluator(payload: EvaluatorCreate) -> Evaluator:
        evaluator = store.save_evaluator(Evaluator(**payload.model_dump()))
        _audit(store, "evaluator.create", "evaluator", evaluator.id, {"kind": evaluator.kind, "is_default": evaluator.is_default})
        return evaluator

    @app.get("/api/evaluators/{evaluatorId}")
    def get_evaluator(evaluatorId: str) -> Evaluator:
        try:
            return store.get_evaluator(evaluatorId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Evaluator not found") from exc

    @app.patch("/api/evaluators/{evaluatorId}")
    def update_evaluator(evaluatorId: str, payload: EvaluatorUpdate) -> Evaluator:
        if _is_evaluator_frozen(store, evaluatorId):
            raise HTTPException(status_code=409, detail="Evaluator is frozen by an existing run")
        try:
            evaluator = store.get_evaluator(evaluatorId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Evaluator not found") from exc
        updated = store.save_evaluator(evaluator.model_copy(update=payload.model_dump(exclude_unset=True)))
        _audit(store, "evaluator.update", "evaluator", updated.id, {"is_default": updated.is_default})
        return updated

    @app.delete("/api/evaluators/{evaluatorId}", status_code=204)
    def delete_evaluator(evaluatorId: str) -> None:
        try:
            store.delete_evaluator(evaluatorId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Evaluator not found") from exc
        _audit(store, "evaluator.delete", "evaluator", evaluatorId, {})
        return None

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
        evaluator = _evaluator_for_goal(store, goal)
        llm = _llm_for_goal(store, settings, goal)
        sandbox = create_execution_sandbox_provider(settings, llm=llm, goal=goal)
        runner = LoopRunner(
            store=store,
            llm=llm,
            sandbox=sandbox,
            tools=tools,
            dataset_mount=_dataset_mount_for_goal(store, goal),
            evaluator=evaluator,
            agent_engine=create_agent_engine(settings, llm=llm, goal=goal, sandbox=sandbox),
        )
        run = runner.start(goal, spec)
        _audit(store, "run.start", "run", run.id, {"goal_id": goal.id, "loop_spec_id": spec.id, "status": run.status})
        if evaluator is not None:
            _audit(store, "evaluator.freeze", "evaluator", evaluator.id, {"run_id": run.id, "snapshot": evaluator.model_dump(mode="json")})
        return run

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

    @app.get("/api/runs/{runId}/artifacts")
    def list_artifacts(runId: str) -> list[Artifact]:
        try:
            store.get_run(runId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc
        return [_sanitize_artifact(artifact) for artifact in store.list_artifacts(runId)]

    @app.get("/api/runs/{runId}/results")
    def get_results(runId: str) -> Results:
        try:
            run = store.get_run(runId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc
        return _assemble_results(run, store.list_artifacts(runId))

    @app.get("/api/runs/{runId}/context")
    def get_run_context(runId: str) -> RunContext:
        try:
            run = store.get_run(runId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found") from exc
        ledger = store.list_context(runId)
        max_tokens = 8000
        try:
            max_tokens = store.get_goal(run.goal_id).budget.max_context_tokens
        except KeyError:
            pass
        pack = ContextManager(max_tokens=max_tokens).build_pack(ledger, task="inspect run context", required_tags=["required"])
        return RunContext(
            ledger=[_sanitize_context_entry(entry) for entry in ledger],
            pack=_sanitize_context_pack(pack),
        )

    @app.get("/api/artifacts/{artifactId}/content")
    def get_artifact_content(artifactId: str) -> ArtifactContent:
        for run in store.list_runs():
            for artifact in store.list_artifacts(run.id):
                if artifact.id == artifactId:
                    metadata = _sanitize_value(artifact.metadata)
                    return ArtifactContent(
                        artifact_id=artifact.id,
                        filename=metadata.get("filename") if isinstance(metadata.get("filename"), str) else None,
                        language=metadata.get("language") if isinstance(metadata.get("language"), str) else None,
                        content=str(metadata.get("content") or ""),
                    )
        raise HTTPException(status_code=404, detail="Artifact not found")

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
        _audit(
            store,
            "gate.decision",
            "gate",
            gate.id,
            {"decision": payload.decision, "note": payload.note, "run_id": gate.run_id},
        )

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
            llm = _llm_for_goal(store, settings, goal)
            sandbox = create_execution_sandbox_provider(settings, llm=llm, goal=goal)
            runner = LoopRunner(
                store=store,
                llm=llm,
                sandbox=sandbox,
                tools=tools,
                dataset_mount=_dataset_mount_for_goal(store, goal),
                evaluator=_evaluator_for_goal(store, goal),
                agent_engine=create_agent_engine(settings, llm=llm, goal=goal, sandbox=sandbox),
            )
            runner.resume_after_gate(run, goal, spec)
        return decided

    return app


def _evaluator_for_goal(store: Store, goal: Goal) -> Evaluator | None:
    if goal.evaluator_id is not None:
        return store.get_evaluator(goal.evaluator_id)
    return store.get_default_evaluator()


def _is_evaluator_frozen(store: Store, evaluator_id: str) -> bool:
    return any(event.action == "evaluator.freeze" and event.subject_id == evaluator_id for event in store.list_audit_events())


def _dataset_mount_for_goal(store: Store, goal: Goal) -> DatasetMount | None:
    dataset = _dataset_for_goal(store, goal)
    if dataset is None:
        return None
    return DatasetMount(host_path=dataset.storage_path, filename=dataset.filename)


def _dataset_for_goal(store: Store, goal: Goal) -> StoredDataset | None:
    if goal.dataset_id is None:
        return None
    return store.get_dataset(goal.dataset_id)


def _parse_dataset_request(content_type: str, body: bytes):
    try:
        return parse_multipart_upload(content_type, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _dataset_kind(filename: str) -> DatasetKind | None:
    suffix = Path(filename).suffix.lower()
    if suffix == ".csv":
        return DatasetKind.CSV
    if suffix == ".parquet":
        return DatasetKind.PARQUET
    return None


def _profile_dataset(dataset: StoredDataset) -> StoredDataset:
    if dataset.kind == DatasetKind.CSV:
        try:
            profile = profile_csv(Path(dataset.storage_path))
        except Exception as exc:
            return dataset.model_copy(update={"status": DatasetStatus.FAILED, "detail": f"CSV profiling failed: {exc}"})
        return dataset.model_copy(update={"status": DatasetStatus.READY, "profile": profile, "detail": None})
    return dataset.model_copy(update={"status": DatasetStatus.FAILED, "detail": "Parquet profiling requires pyarrow or pandas, which is not installed"})


def _public_dataset(dataset: StoredDataset) -> Dataset:
    data = dataset.model_dump(exclude={"storage_path"})
    if data.get("profile") is not None:
        data["profile"] = _sanitize_value(data["profile"])
    return Dataset.model_validate(data)


def _public_llm_provider(provider: StoredLLMProvider) -> LLMProviderView:
    return LLMProviderView(
        id=provider.id,
        name=provider.name,
        kind=provider.kind,
        base_url=provider.base_url,
        model=provider.model,
        timeout_seconds=provider.timeout_seconds,
        is_default=provider.is_default,
        has_api_key=provider.encrypted_api_key is not None,
        created_at=provider.created_at,
    )


def _llm_for_goal(store: Store, settings: Settings, goal: Goal):
    try:
        if goal.llm_provider_id:
            return create_llm_provider_from_config(store.get_llm_provider(goal.llm_provider_id), settings)
        default_provider = store.get_default_llm_provider()
        if default_provider is not None:
            return create_llm_provider_from_config(default_provider, settings)
        return create_llm_provider(settings)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="LLM provider not found") from exc
    except LLMProviderError as exc:
        raise HTTPException(status_code=422, detail=_sanitize_provider_detail(str(exc), None, settings)) from exc


def _planner_http_error(exc: Exception, settings: Settings) -> HTTPException:
    # 502: the upstream LLM failed or returned unusable output. Never fabricate a loop.
    detail = _sanitize_provider_detail(str(exc), None, settings)
    return HTTPException(status_code=502, detail=detail or "The LLM provider failed to produce a valid result.")


def _sanitize_provider_detail(detail: str, provider: StoredLLMProvider | None, settings: Settings) -> str:
    if provider is not None:
        secret = SecretCipher(settings.secret_key).decrypt(provider.encrypted_api_key) if provider.encrypted_api_key else None
        if secret:
            detail = detail.replace(secret, "[REDACTED_SECRET]")
    return re.sub(r"Bearer\s+[^\s]+", "Bearer [REDACTED_SECRET]", detail)


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


def _audit(store: Store, action: str, subject_type: str, subject_id: str, payload: dict[str, object]) -> AuditEvent:
    return store.append_audit_event(
        AuditEvent(
            action=action,
            subject_type=subject_type,
            subject_id=subject_id,
            payload=payload,
        )
    )


def _assemble_results(run: Run, artifacts: list[Artifact]) -> Results:
    insights: list[InsightResult] = []
    models: list[ModelResult] = []
    rejected = 0

    for artifact in artifacts:
        metadata = _sanitize_value(artifact.metadata)
        if artifact.kind == "insight":
            if bool(metadata.get("passed")):
                insights.append(
                    InsightResult(
                        id=artifact.id,
                        rank=len(insights) + 1,
                        claim=str(metadata["claim"]),
                        passed=True,
                        test=str(metadata["test"]),
                        p_value=float(metadata["p_value"]),
                        effect_name=str(metadata["effect_name"]),
                        effect_value=float(metadata["effect_value"]),
                        n=int(metadata["n"]),
                        correction=metadata.get("correction"),
                        plot_ref=metadata.get("plot_ref"),
                    )
                )
            else:
                rejected += 1
        elif artifact.kind == "model":
            if bool(metadata.get("beats_baseline")) and bool(metadata.get("leakage_ok")):
                models.append(
                    ModelResult(
                        id=artifact.id,
                        name=str(metadata["name"]),
                        metric_name=str(metadata["metric_name"]),
                        metric_value=float(metadata["metric_value"]),
                        baseline_name=str(metadata["baseline_name"]),
                        baseline_value=float(metadata["baseline_value"]),
                        beats_baseline=True,
                        leakage_ok=True,
                    )
                )
            else:
                rejected += 1

    duration_s = None
    if run.started_at is not None and run.ended_at is not None:
        duration_s = (run.ended_at - run.started_at).total_seconds()
    return Results(
        run_id=run.id,
        status=run.status,
        summary=ResultsSummary(
            validated=len(insights) + len(models),
            rejected=rejected,
            cost_usd=run.spent_usd,
            duration_s=duration_s,
        ),
        insights=insights,
        models=models,
    )


def _sanitize_artifact(artifact: Artifact) -> Artifact:
    return artifact.model_copy(update={"metadata": _sanitize_value(artifact.metadata)})


def _sanitize_context_pack(pack: ContextPack) -> ContextPack:
    return pack.model_copy(update={"entries": [_sanitize_context_entry(entry) for entry in pack.entries], "summary": _sanitize_text(pack.summary)})


def _sanitize_context_entry(entry: ContextEntry) -> ContextEntry:
    return entry.model_copy(update={"text": _sanitize_text(entry.text)})


def _sanitize_value(value):
    if isinstance(value, str):
        return _sanitize_text(value)
    if isinstance(value, list):
        return [_sanitize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _sanitize_value(item) for key, item in value.items()}
    return value


def _sanitize_text(text: str) -> str:
    text = re.sub(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b", "[REDACTED_EMAIL]", text)
    return re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", text)


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
