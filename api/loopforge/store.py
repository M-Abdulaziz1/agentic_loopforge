from __future__ import annotations

from typing import Protocol

from api.loopforge.domain import Artifact, AuditEvent, ClarificationSession, ContextEntry, Evaluator, Gate, GateStatus, Goal, LoopSpec, LoopTemplate, Run, RunEvent, StoredDataset, StoredLLMProvider


class Store(Protocol):
    def save_goal(self, goal: Goal) -> Goal: ...
    def get_goal(self, goal_id: str) -> Goal: ...
    def list_goals(self) -> list[Goal]: ...
    def delete_goal(self, goal_id: str) -> None: ...
    def save_clarification(self, session: ClarificationSession) -> ClarificationSession: ...
    def get_clarification_by_goal(self, goal_id: str) -> ClarificationSession: ...
    def save_loop_spec(self, spec: LoopSpec) -> LoopSpec: ...
    def get_loop_spec(self, spec_id: str) -> LoopSpec: ...
    def list_loop_specs(self, goal_id: str | None = None) -> list[LoopSpec]: ...
    def save_template(self, template: LoopTemplate) -> LoopTemplate: ...
    def get_template(self, template_id: str) -> LoopTemplate: ...
    def list_templates(self) -> list[LoopTemplate]: ...
    def delete_template(self, template_id: str) -> None: ...
    def save_llm_provider(self, provider: StoredLLMProvider) -> StoredLLMProvider: ...
    def get_llm_provider(self, provider_id: str) -> StoredLLMProvider: ...
    def list_llm_providers(self) -> list[StoredLLMProvider]: ...
    def get_default_llm_provider(self) -> StoredLLMProvider | None: ...
    def delete_llm_provider(self, provider_id: str) -> None: ...
    def save_dataset(self, dataset: StoredDataset) -> StoredDataset: ...
    def get_dataset(self, dataset_id: str) -> StoredDataset: ...
    def list_datasets(self) -> list[StoredDataset]: ...
    def delete_dataset(self, dataset_id: str) -> StoredDataset: ...
    def save_evaluator(self, evaluator: Evaluator) -> Evaluator: ...
    def get_evaluator(self, evaluator_id: str) -> Evaluator: ...
    def list_evaluators(self) -> list[Evaluator]: ...
    def get_default_evaluator(self) -> Evaluator | None: ...
    def delete_evaluator(self, evaluator_id: str) -> None: ...
    def save_run(self, run: Run) -> Run: ...
    def get_run(self, run_id: str) -> Run: ...
    def list_runs(self) -> list[Run]: ...
    def append_event(self, event: RunEvent) -> RunEvent: ...
    def list_events(self, run_id: str) -> list[RunEvent]: ...
    def save_artifact(self, artifact: Artifact) -> Artifact: ...
    def list_artifacts(self, run_id: str) -> list[Artifact]: ...
    def append_context(self, entry: ContextEntry) -> ContextEntry: ...
    def list_context(self, run_id: str) -> list[ContextEntry]: ...
    def save_gate(self, gate: Gate) -> Gate: ...
    def get_gate(self, gate_id: str) -> Gate: ...
    def list_gates(self, status: GateStatus | None = None, run_id: str | None = None) -> list[Gate]: ...
    def append_audit_event(self, event: AuditEvent) -> AuditEvent: ...
    def list_audit_events(self) -> list[AuditEvent]: ...


class InMemoryStore:
    def __init__(self) -> None:
        self.goals: dict[str, Goal] = {}
        self.loop_specs: dict[str, LoopSpec] = {}
        self.templates: dict[str, LoopTemplate] = {}
        self.llm_providers: dict[str, StoredLLMProvider] = {}
        self.datasets: dict[str, StoredDataset] = {}
        self.evaluators: dict[str, Evaluator] = {}
        self.runs: dict[str, Run] = {}
        self.events: dict[str, list[RunEvent]] = {}
        self.artifacts: dict[str, list[Artifact]] = {}
        self.context_entries: dict[str, list[ContextEntry]] = {}
        self.gates: dict[str, Gate] = {}
        self.clarifications_by_goal: dict[str, ClarificationSession] = {}
        self.audit_events: list[AuditEvent] = []

    def save_goal(self, goal: Goal) -> Goal:
        self.goals[goal.id] = goal
        return goal

    def get_goal(self, goal_id: str) -> Goal:
        return self.goals[goal_id]

    def list_goals(self) -> list[Goal]:
        return sorted(self.goals.values(), key=lambda goal: goal.created_at, reverse=True)

    def delete_goal(self, goal_id: str) -> None:
        # Cascade: drop the goal plus every record scoped to it — its clarification,
        # loop specs, and runs (with each run's events/artifacts/context/gates).
        if goal_id not in self.goals:
            raise KeyError(goal_id)
        for run in [run for run in self.runs.values() if run.goal_id == goal_id]:
            self.events.pop(run.id, None)
            self.artifacts.pop(run.id, None)
            self.context_entries.pop(run.id, None)
            for gate_id in [gid for gid, gate in self.gates.items() if gate.run_id == run.id]:
                del self.gates[gate_id]
            del self.runs[run.id]
        for spec_id in [sid for sid, spec in self.loop_specs.items() if spec.goal_id == goal_id]:
            del self.loop_specs[spec_id]
        self.clarifications_by_goal.pop(goal_id, None)
        del self.goals[goal_id]

    def save_clarification(self, session: ClarificationSession) -> ClarificationSession:
        self.clarifications_by_goal[session.goal_id] = session
        return session

    def get_clarification_by_goal(self, goal_id: str) -> ClarificationSession:
        return self.clarifications_by_goal[goal_id]

    def save_loop_spec(self, spec: LoopSpec) -> LoopSpec:
        self.loop_specs[spec.id] = spec
        return spec

    def get_loop_spec(self, spec_id: str) -> LoopSpec:
        return self.loop_specs[spec_id]

    def list_loop_specs(self, goal_id: str | None = None) -> list[LoopSpec]:
        specs = list(self.loop_specs.values())
        if goal_id is not None:
            specs = [spec for spec in specs if spec.goal_id == goal_id]
        return sorted(specs, key=lambda spec: spec.created_at, reverse=True)

    def save_template(self, template: LoopTemplate) -> LoopTemplate:
        self.templates[template.id] = template
        return template

    def get_template(self, template_id: str) -> LoopTemplate:
        return self.templates[template_id]

    def list_templates(self) -> list[LoopTemplate]:
        return sorted(self.templates.values(), key=lambda template: template.created_at, reverse=True)

    def delete_template(self, template_id: str) -> None:
        del self.templates[template_id]

    def save_llm_provider(self, provider: StoredLLMProvider) -> StoredLLMProvider:
        if provider.is_default:
            for existing_id, existing in list(self.llm_providers.items()):
                if existing_id != provider.id and existing.is_default:
                    self.llm_providers[existing_id] = existing.model_copy(update={"is_default": False})
        self.llm_providers[provider.id] = provider
        return provider

    def get_llm_provider(self, provider_id: str) -> StoredLLMProvider:
        return self.llm_providers[provider_id]

    def list_llm_providers(self) -> list[StoredLLMProvider]:
        return sorted(self.llm_providers.values(), key=lambda provider: provider.created_at, reverse=True)

    def get_default_llm_provider(self) -> StoredLLMProvider | None:
        return next((provider for provider in self.llm_providers.values() if provider.is_default), None)

    def delete_llm_provider(self, provider_id: str) -> None:
        del self.llm_providers[provider_id]

    def save_dataset(self, dataset: StoredDataset) -> StoredDataset:
        self.datasets[dataset.id] = dataset
        return dataset

    def get_dataset(self, dataset_id: str) -> StoredDataset:
        return self.datasets[dataset_id]

    def list_datasets(self) -> list[StoredDataset]:
        return sorted(self.datasets.values(), key=lambda dataset: dataset.created_at, reverse=True)

    def delete_dataset(self, dataset_id: str) -> StoredDataset:
        return self.datasets.pop(dataset_id)

    def save_evaluator(self, evaluator: Evaluator) -> Evaluator:
        if evaluator.is_default:
            for existing_id, existing in list(self.evaluators.items()):
                if existing_id != evaluator.id and existing.is_default:
                    self.evaluators[existing_id] = existing.model_copy(update={"is_default": False})
        self.evaluators[evaluator.id] = evaluator
        return evaluator

    def get_evaluator(self, evaluator_id: str) -> Evaluator:
        return self.evaluators[evaluator_id]

    def list_evaluators(self) -> list[Evaluator]:
        return sorted(self.evaluators.values(), key=lambda evaluator: evaluator.created_at, reverse=True)

    def get_default_evaluator(self) -> Evaluator | None:
        return next((evaluator for evaluator in self.evaluators.values() if evaluator.is_default), None)

    def delete_evaluator(self, evaluator_id: str) -> None:
        del self.evaluators[evaluator_id]

    def save_run(self, run: Run) -> Run:
        self.runs[run.id] = run
        return run

    def get_run(self, run_id: str) -> Run:
        return self.runs[run_id]

    def list_runs(self) -> list[Run]:
        return sorted(
            self.runs.values(),
            key=lambda run: run.started_at or run.ended_at or run.id,
            reverse=True,
        )

    def append_event(self, event: RunEvent) -> RunEvent:
        events = self.events.setdefault(event.run_id, [])
        stored = event.model_copy(update={"seq": len(events) + 1})
        events.append(stored)
        return stored

    def list_events(self, run_id: str) -> list[RunEvent]:
        return list(self.events.get(run_id, []))

    def save_artifact(self, artifact: Artifact) -> Artifact:
        artifacts = self.artifacts.setdefault(artifact.run_id, [])
        existing_index = next((index for index, existing in enumerate(artifacts) if existing.id == artifact.id), None)
        if existing_index is None:
            artifacts.append(artifact)
        else:
            artifacts[existing_index] = artifact
        return artifact

    def list_artifacts(self, run_id: str) -> list[Artifact]:
        return list(self.artifacts.get(run_id, []))

    def append_context(self, entry: ContextEntry) -> ContextEntry:
        self.context_entries.setdefault(entry.run_id, []).append(entry)
        return entry

    def list_context(self, run_id: str) -> list[ContextEntry]:
        return list(self.context_entries.get(run_id, []))

    def save_gate(self, gate: Gate) -> Gate:
        self.gates[gate.id] = gate
        return gate

    def get_gate(self, gate_id: str) -> Gate:
        return self.gates[gate_id]

    def list_gates(self, status: GateStatus | None = None, run_id: str | None = None) -> list[Gate]:
        gates = list(self.gates.values())
        if status is not None:
            gates = [gate for gate in gates if gate.status == status]
        if run_id is not None:
            gates = [gate for gate in gates if gate.run_id == run_id]
        return gates

    def append_audit_event(self, event: AuditEvent) -> AuditEvent:
        self.audit_events.append(event)
        return event

    def list_audit_events(self) -> list[AuditEvent]:
        return list(self.audit_events)
