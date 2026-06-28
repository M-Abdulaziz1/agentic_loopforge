import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Connection,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { AgentNode } from "../components/run/AgentNode";
import { useLoopSpec, useUpdateLoopSpec } from "../lib/api/loopspecs";
import { validateLoopGraph } from "../lib/validateLoopGraph";
import type { AgentNodeData } from "../lib/buildAgentFlow";
import type { LoopSpecAgent } from "../lib/api/types";

export type BuilderNodeData = AgentNodeData & { systemPrompt: string };

const nodeTypes = { agent: AgentNode };

export function LoopBuilderPage() {
  const { specId = "" } = useParams();
  const navigate = useNavigate();
  const { data: spec, isLoading } = useLoopSpec(specId);
  const update = useUpdateLoopSpec(specId);

  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Seed the canvas from the spec once it loads.
  useEffect(() => {
    if (!spec) return;
    setNodes(
      spec.agents.map((a, i) => ({
        id: a.name,
        type: "agent",
        position: { x: 40 + i * 250, y: 140 },
        data: {
          name: a.name,
          role: a.role,
          status: "idle",
          tools: a.tools,
          selected: false,
          systemPrompt: a.system_prompt,
        },
      })),
    );
    setEdges(
      spec.handoffs
        .filter((h) => h.from && h.to)
        .map((h) => ({ id: `${h.from}->${h.to}`, source: h.from, target: h.to, label: "handoff" })),
    );
  }, [spec, setNodes, setEdges]);

  const handoffs = useMemo(
    () => edges.map((e) => ({ from: e.source, to: e.target })),
    [edges],
  );
  const errors = useMemo(
    () => validateLoopGraph(nodes.map((n) => n.id), handoffs),
    [nodes, handoffs],
  );

  function onConnect(c: Connection) {
    setEdges((es) => addEdge({ ...c, label: "handoff" }, es));
  }

  function addAgent() {
    const id = `agent_${nodes.length + 1}`;
    const node: Node<BuilderNodeData> = {
      id,
      type: "agent",
      position: { x: 60, y: 320 },
      data: { name: id, role: "new agent", status: "idle", tools: [], selected: false, systemPrompt: "" },
    };
    setNodes((ns) => [...ns, node]);
  }

  async function save() {
    if (errors.length > 0) return;
    const agents: LoopSpecAgent[] = nodes.map((n) => ({
      name: n.data.name,
      role: n.data.role,
      system_prompt: n.data.systemPrompt,
      tools: n.data.tools,
    }));
    await update.mutateAsync({ agents, handoffs });
    navigate(`/specs/${specId}`);
  }

  if (isLoading || !spec) return <div className="p-8 text-mut">Loading spec…</div>;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-6 py-4">
        <div className="text-sm text-mut">
          Loop Specs / <b className="text-ink">Builder</b>{" "}
          <span className="font-mono text-mut">spec v{spec.version}</span>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={addAgent}
          className="rounded-xl border border-[var(--line2)] bg-[var(--glass2)] px-4 py-2 text-[13px] font-semibold"
        >
          + Add agent
        </button>
        <button
          type="button"
          onClick={() => navigate(`/specs/${specId}`)}
          className="rounded-xl border border-[var(--line2)] bg-[var(--glass2)] px-4 py-2 text-[13px] font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={errors.length > 0 || update.isPending}
          className="rounded-xl bg-gradient-to-br from-violet to-teal px-5 py-2 text-[13px] font-bold text-white disabled:opacity-50"
        >
          Save spec
        </button>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_300px] overflow-hidden">
        <div className="relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={26} size={1.1} color="#ffffff22" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor="#8a6cff" style={{ background: "rgba(12,12,30,.6)" }} />
          </ReactFlow>
        </div>

        <aside className="overflow-auto border-l border-[var(--line)] p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mut">
            Validation
          </h3>
          {errors.length === 0 ? (
            <div className="rounded-xl border border-[rgba(70,227,173,.3)] bg-[rgba(70,227,173,.1)] px-3.5 py-3 text-[13px] font-semibold text-[#9af3d4]">
              ✓ Graph is valid — ready to save.
            </div>
          ) : (
            <div className="space-y-2.5">
              {errors.map((e, i) => (
                <div
                  key={`${e.code}-${i}`}
                  className="rounded-xl border border-[rgba(255,107,154,.35)] bg-[rgba(255,107,154,.1)] px-3.5 py-2.5 text-[12.5px] text-[#ffd0e0]"
                >
                  <div className="font-bold">{e.code}</div>
                  <div className="mt-0.5 text-ink2">{e.message}</div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[12px] leading-relaxed text-mut">
            Drag to connect handoffs. Select an edge and press Delete to remove it. Tool
            permissions stay constrained by the goal's capability toggles — the server
            re-validates on save.
          </p>
        </aside>
      </div>
    </div>
  );
}
