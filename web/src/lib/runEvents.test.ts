import { reduceRunEvents } from "./runEvents";
import type { RunEvent } from "./api/types";

function ev(seq: number, type: RunEvent["type"], payload: Record<string, unknown>): RunEvent {
  return {
    id: `e${seq}`,
    run_id: "run_1",
    seq,
    type,
    message: "",
    payload,
    created_at: "2026-06-28T00:00:00Z",
  };
}

const agents = ["planner", "analyst", "validator", "reporter"];

test("derives agent status, meters, gate and run status", () => {
  const view = reduceRunEvents(
    [
      ev(1, "node_start", { agent: "planner" }),
      ev(2, "node_end", { agent: "planner" }),
      ev(3, "node_start", { agent: "analyst" }),
      ev(4, "tool_call", { tool: "sandbox.exec", agent: "analyst" }),
      ev(5, "cost_update", { spent_usd: 0.42, spent_steps: 5, context_tokens: 3100 }),
      ev(6, "gate_pending", { gate_id: "gate_1", gate_type: "before_finalize" }),
      ev(7, "run_status", { status: "running" }),
    ],
    agents,
  );

  expect(view.agentStatus).toEqual({
    planner: "done",
    analyst: "running",
    validator: "idle",
    reporter: "idle",
  });
  expect(view.meters).toEqual({ spentUsd: 0.42, spentSteps: 5, contextTokens: 3100 });
  expect(view.pendingGate).toEqual({ gateId: "gate_1", gateType: "before_finalize" });
  expect(view.runStatus).toBe("running");
  expect(view.eventsByAgent.analyst.map((e) => e.type)).toEqual(["node_start", "tool_call"]);
});

test("a node_start after a pending gate clears it (gate approved → loop resumes)", () => {
  const view = reduceRunEvents(
    [
      ev(1, "gate_pending", { gate_id: "g", gate_type: "before_finalize" }),
      ev(2, "node_start", { agent: "reporter" }),
    ],
    agents,
  );
  expect(view.pendingGate).toBeNull();
  expect(view.agentStatus.reporter).toBe("running");
});

test("events are reduced in seq order regardless of input order", () => {
  const view = reduceRunEvents(
    [ev(2, "node_end", { agent: "planner" }), ev(1, "node_start", { agent: "planner" })],
    agents,
  );
  expect(view.agentStatus.planner).toBe("done");
});
