import type { RunEvent, RunStatus } from "./api/types";

export type AgentStatus = "idle" | "running" | "done";

export type RunView = {
  agentStatus: Record<string, AgentStatus>;
  meters: { spentUsd?: number; spentSteps?: number; contextTokens?: number };
  pendingGate: { gateId: string; gateType: string } | null;
  runStatus: RunStatus | null;
  eventsByAgent: Record<string, RunEvent[]>;
};

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/**
 * Pure fold of a run's event stream into the state the Run view renders.
 * Deterministic and order-independent (sorts by seq).
 */
export function reduceRunEvents(events: RunEvent[], agentNames: string[]): RunView {
  const agentStatus: Record<string, AgentStatus> = {};
  const eventsByAgent: Record<string, RunEvent[]> = {};
  for (const name of agentNames) {
    agentStatus[name] = "idle";
    eventsByAgent[name] = [];
  }

  const meters: RunView["meters"] = {};
  let pendingGate: RunView["pendingGate"] = null;
  let runStatus: RunStatus | null = null;

  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    const agent = str(e.payload.agent);
    if (agent && eventsByAgent[agent]) eventsByAgent[agent].push(e);

    switch (e.type) {
      case "node_start":
        if (agent && agent in agentStatus) agentStatus[agent] = "running";
        pendingGate = null;
        break;
      case "node_end":
        if (agent && agent in agentStatus) agentStatus[agent] = "done";
        break;
      case "cost_update": {
        const usd = num(e.payload.spent_usd);
        const steps = num(e.payload.spent_steps);
        const tokens = num(e.payload.context_tokens);
        if (usd !== undefined) meters.spentUsd = usd;
        if (steps !== undefined) meters.spentSteps = steps;
        if (tokens !== undefined) meters.contextTokens = tokens;
        break;
      }
      case "gate_pending": {
        const gateId = str(e.payload.gate_id);
        const gateType = str(e.payload.gate_type);
        if (gateId && gateType) pendingGate = { gateId, gateType };
        break;
      }
      case "run_status": {
        const status = str(e.payload.status);
        if (status) runStatus = status as RunStatus;
        break;
      }
      default:
        break;
    }
  }

  return { agentStatus, meters, pendingGate, runStatus, eventsByAgent };
}
