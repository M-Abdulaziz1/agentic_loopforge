from __future__ import annotations

import sqlite3
from pathlib import Path
from threading import RLock
from typing import TypeVar

from pydantic import BaseModel

from api.loopforge.domain import Artifact, AuditEvent, ClarificationSession, ContextEntry, Gate, GateStatus, Goal, LoopSpec, LoopTemplate, Run, RunEvent, StoredLLMProvider

ModelT = TypeVar("ModelT", bound=BaseModel)


class SQLiteStore:
    def __init__(self, path: str | Path) -> None:
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._connection = sqlite3.connect(self.path, check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS records (
                kind TEXT NOT NULL,
                id TEXT NOT NULL,
                goal_id TEXT,
                run_id TEXT,
                payload TEXT NOT NULL,
                PRIMARY KEY (kind, id)
            )
            """
        )
        self._connection.execute("CREATE INDEX IF NOT EXISTS idx_records_goal ON records(kind, goal_id)")
        self._connection.execute("CREATE INDEX IF NOT EXISTS idx_records_run ON records(kind, run_id)")
        self._connection.commit()

    def save_goal(self, goal: Goal) -> Goal:
        self._save("goal", goal)
        return goal

    def get_goal(self, goal_id: str) -> Goal:
        return self._get("goal", goal_id, Goal)

    def list_goals(self) -> list[Goal]:
        return sorted(self._list("goal", Goal), key=lambda goal: goal.created_at, reverse=True)

    def save_clarification(self, session: ClarificationSession) -> ClarificationSession:
        self._save("clarification", session, goal_id=session.goal_id)
        return session

    def get_clarification_by_goal(self, goal_id: str) -> ClarificationSession:
        sessions = self._list("clarification", ClarificationSession, goal_id=goal_id)
        if not sessions:
            raise KeyError(goal_id)
        return sessions[0]

    def save_loop_spec(self, spec: LoopSpec) -> LoopSpec:
        self._save("loop_spec", spec, goal_id=spec.goal_id)
        return spec

    def get_loop_spec(self, spec_id: str) -> LoopSpec:
        return self._get("loop_spec", spec_id, LoopSpec)

    def list_loop_specs(self, goal_id: str | None = None) -> list[LoopSpec]:
        specs = self._list("loop_spec", LoopSpec, goal_id=goal_id)
        return sorted(specs, key=lambda spec: spec.created_at, reverse=True)

    def save_template(self, template: LoopTemplate) -> LoopTemplate:
        self._save("template", template)
        return template

    def get_template(self, template_id: str) -> LoopTemplate:
        return self._get("template", template_id, LoopTemplate)

    def list_templates(self) -> list[LoopTemplate]:
        return sorted(self._list("template", LoopTemplate), key=lambda template: template.created_at, reverse=True)

    def delete_template(self, template_id: str) -> None:
        with self._lock:
            cursor = self._connection.execute("DELETE FROM records WHERE kind = ? AND id = ?", ("template", template_id))
            self._connection.commit()
        if cursor.rowcount == 0:
            raise KeyError(template_id)

    def save_llm_provider(self, provider: StoredLLMProvider) -> StoredLLMProvider:
        if provider.is_default:
            for existing in self.list_llm_providers():
                if existing.id != provider.id and existing.is_default:
                    self._save("llm_provider", existing.model_copy(update={"is_default": False}))
        self._save("llm_provider", provider)
        return provider

    def get_llm_provider(self, provider_id: str) -> StoredLLMProvider:
        return self._get("llm_provider", provider_id, StoredLLMProvider)

    def list_llm_providers(self) -> list[StoredLLMProvider]:
        return sorted(self._list("llm_provider", StoredLLMProvider), key=lambda provider: provider.created_at, reverse=True)

    def get_default_llm_provider(self) -> StoredLLMProvider | None:
        return next((provider for provider in self.list_llm_providers() if provider.is_default), None)

    def delete_llm_provider(self, provider_id: str) -> None:
        with self._lock:
            cursor = self._connection.execute("DELETE FROM records WHERE kind = ? AND id = ?", ("llm_provider", provider_id))
            self._connection.commit()
        if cursor.rowcount == 0:
            raise KeyError(provider_id)

    def save_run(self, run: Run) -> Run:
        self._save("run", run, goal_id=run.goal_id)
        return run

    def get_run(self, run_id: str) -> Run:
        return self._get("run", run_id, Run)

    def list_runs(self) -> list[Run]:
        return sorted(
            self._list("run", Run),
            key=lambda run: run.started_at or run.ended_at or run.id,
            reverse=True,
        )

    def append_event(self, event: RunEvent) -> RunEvent:
        stored = event.model_copy(update={"seq": len(self.list_events(event.run_id)) + 1})
        self._save("event", stored, run_id=stored.run_id)
        return stored

    def list_events(self, run_id: str) -> list[RunEvent]:
        return sorted(self._list("event", RunEvent, run_id=run_id), key=lambda event: event.seq)

    def save_artifact(self, artifact: Artifact) -> Artifact:
        self._save("artifact", artifact, run_id=artifact.run_id)
        return artifact

    def list_artifacts(self, run_id: str) -> list[Artifact]:
        return sorted(self._list("artifact", Artifact, run_id=run_id), key=lambda artifact: artifact.created_at)

    def append_context(self, entry: ContextEntry) -> ContextEntry:
        self._save("context", entry, run_id=entry.run_id)
        return entry

    def list_context(self, run_id: str) -> list[ContextEntry]:
        return self._list("context", ContextEntry, run_id=run_id)

    def save_gate(self, gate: Gate) -> Gate:
        self._save("gate", gate, run_id=gate.run_id)
        return gate

    def get_gate(self, gate_id: str) -> Gate:
        return self._get("gate", gate_id, Gate)

    def list_gates(self, status: GateStatus | None = None, run_id: str | None = None) -> list[Gate]:
        gates = self._list("gate", Gate, run_id=run_id)
        if status is not None:
            gates = [gate for gate in gates if gate.status == status]
        return gates

    def append_audit_event(self, event: AuditEvent) -> AuditEvent:
        self._save("audit", event)
        return event

    def list_audit_events(self) -> list[AuditEvent]:
        return sorted(self._list("audit", AuditEvent), key=lambda event: event.created_at)

    def _save(self, kind: str, model: BaseModel, *, goal_id: str | None = None, run_id: str | None = None) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO records(kind, id, goal_id, run_id, payload)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(kind, id) DO UPDATE SET
                    goal_id = excluded.goal_id,
                    run_id = excluded.run_id,
                    payload = excluded.payload
                """,
                (kind, getattr(model, "id"), goal_id, run_id, model.model_dump_json()),
            )
            self._connection.commit()

    def _get(self, kind: str, model_id: str, model_type: type[ModelT]) -> ModelT:
        with self._lock:
            row = self._connection.execute(
                "SELECT payload FROM records WHERE kind = ? AND id = ?",
                (kind, model_id),
            ).fetchone()
        if row is None:
            raise KeyError(model_id)
        return model_type.model_validate_json(row[0])

    def _list(
        self,
        kind: str,
        model_type: type[ModelT],
        *,
        goal_id: str | None = None,
        run_id: str | None = None,
    ) -> list[ModelT]:
        clauses = ["kind = ?"]
        params: list[str] = [kind]
        if goal_id is not None:
            clauses.append("goal_id = ?")
            params.append(goal_id)
        if run_id is not None:
            clauses.append("run_id = ?")
            params.append(run_id)
        query = f"SELECT payload FROM records WHERE {' AND '.join(clauses)}"
        with self._lock:
            rows = self._connection.execute(query, params).fetchall()
        return [model_type.model_validate_json(row[0]) for row in rows]
