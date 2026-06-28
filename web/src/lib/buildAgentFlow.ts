import type { Edge, Node } from "reactflow";
import type { LoopSpecAgent } from "./api/types";
import type { AgentStatus, RunView } from "./runEvents";

export type AgentNodeData = {
  name: string;
  role: string;
  status: AgentStatus;
  tools: string[];
  selected: boolean;
};

/**
 * Pure mapping from a loop spec + reduced run view to React Flow nodes/edges.
 * Auto-lays agents left→right; edges come from handoffs and animate along the
 * currently-active transition (done → running).
 */
export function buildAgentFlow(
  agents: LoopSpecAgent[],
  handoffs: Array<Record<string, string>>,
  view: RunView,
  selectedId: string | null,
): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  const nodes: Node<AgentNodeData>[] = agents.map((a, i) => ({
    id: a.name,
    type: "agent",
    position: { x: 40 + i * 260, y: 120 },
    data: {
      name: a.name,
      role: a.role,
      status: view.agentStatus[a.name] ?? "idle",
      tools: a.tools,
      selected: a.name === selectedId,
    },
  }));

  const edges: Edge[] = handoffs
    .filter((h) => h.from && h.to)
    .map((h) => {
      const source = h.from;
      const target = h.to;
      const animated =
        view.agentStatus[source] === "done" && view.agentStatus[target] === "running";
      return {
        id: `${source}->${target}`,
        source,
        target,
        animated,
        label: "handoff",
      };
    });

  return { nodes, edges };
}
