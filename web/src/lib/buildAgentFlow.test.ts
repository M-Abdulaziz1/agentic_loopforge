import { buildAgentFlow } from "./buildAgentFlow";
import type { RunView } from "./runEvents";
import type { LoopSpecAgent } from "./api/types";

const agents: LoopSpecAgent[] = [
  { name: "planner", role: "plan", system_prompt: "", tools: ["mcp.schema"] },
  { name: "analyst", role: "eda", system_prompt: "", tools: ["sandbox.exec"] },
];
const handoffs = [{ from: "planner", to: "analyst" }];

const view: RunView = {
  agentStatus: { planner: "done", analyst: "running" },
  meters: {},
  pendingGate: null,
  runStatus: "running",
  eventsByAgent: { planner: [], analyst: [] },
};

test("maps agents to nodes with live status and selection", () => {
  const { nodes } = buildAgentFlow(agents, handoffs, view, "analyst");
  expect(nodes).toHaveLength(2);
  expect(nodes[0].data.status).toBe("done");
  expect(nodes[1].data.selected).toBe(true);
  expect(nodes[1].type).toBe("agent");
});

test("maps handoffs to edges and animates the active transition", () => {
  const { edges } = buildAgentFlow(agents, handoffs, view, null);
  expect(edges).toHaveLength(1);
  expect(edges[0].id).toBe("planner->analyst");
  expect(edges[0].animated).toBe(true);
});
