import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";
import { AgentNode } from "./AgentNode";
import { buildAgentFlow } from "../../lib/buildAgentFlow";
import type { RunView } from "../../lib/runEvents";
import type { LoopSpecAgent } from "../../lib/api/types";

const nodeTypes = { agent: AgentNode };

type Props = {
  agents: LoopSpecAgent[];
  handoffs: Array<Record<string, string>>;
  view: RunView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

export function AgentCanvas({ agents, handoffs, view, selectedId, onSelect }: Props) {
  const { nodes, edges } = useMemo(
    () => buildAgentFlow(agents, handoffs, view, selectedId),
    [agents, handoffs, view, selectedId],
  );

  const onNodeClick: NodeMouseHandler = (_e, node) => onSelect(node.id);

  return (
    <div className="size-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelect(null)}
        fitView
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ style: { stroke: "url(#lf-edge)", strokeWidth: 2 } }}
      >
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <defs>
            <linearGradient id="lf-edge" x1="0" x2="1">
              <stop offset="0" stopColor="#171717" />
              <stop offset="1" stopColor="#0070f3" />
            </linearGradient>
          </defs>
        </svg>
        <Background variant={BackgroundVariant.Dots} gap={26} size={1.1} color="rgba(23,23,23,0.12)" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(23,23,23,.06)"
          style={{ background: "#ffffff", border: "1px solid #ebebeb" }}
          nodeColor="#171717"
        />
      </ReactFlow>
    </div>
  );
}
