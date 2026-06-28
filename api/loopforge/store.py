from __future__ import annotations

from api.loopforge.domain import ClarificationSession, ContextEntry, Gate, Goal, LoopSpec, Run, RunEvent


class InMemoryStore:
    def __init__(self) -> None:
        self.goals: dict[str, Goal] = {}
        self.loop_specs: dict[str, LoopSpec] = {}
        self.runs: dict[str, Run] = {}
        self.events: dict[str, list[RunEvent]] = {}
        self.context_entries: dict[str, list[ContextEntry]] = {}
        self.gates: dict[str, Gate] = {}
        self.clarifications_by_goal: dict[str, ClarificationSession] = {}

    def save_goal(self, goal: Goal) -> Goal:
        self.goals[goal.id] = goal
        return goal

    def get_goal(self, goal_id: str) -> Goal:
        return self.goals[goal_id]

    def list_goals(self) -> list[Goal]:
        return sorted(self.goals.values(), key=lambda goal: goal.created_at, reverse=True)

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

    def save_run(self, run: Run) -> Run:
        self.runs[run.id] = run
        return run

    def get_run(self, run_id: str) -> Run:
        return self.runs[run_id]

    def append_event(self, event: RunEvent) -> RunEvent:
        events = self.events.setdefault(event.run_id, [])
        stored = event.model_copy(update={"seq": len(events) + 1})
        events.append(stored)
        return stored

    def list_events(self, run_id: str) -> list[RunEvent]:
        return list(self.events.get(run_id, []))

    def append_context(self, entry: ContextEntry) -> ContextEntry:
        self.context_entries.setdefault(entry.run_id, []).append(entry)
        return entry

    def list_context(self, run_id: str) -> list[ContextEntry]:
        return list(self.context_entries.get(run_id, []))

    def save_gate(self, gate: Gate) -> Gate:
        self.gates[gate.id] = gate
        return gate
