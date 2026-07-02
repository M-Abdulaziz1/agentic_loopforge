import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Connection,
  type Node,
  type NodeMouseHandler,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { AgentNode } from "../components/run/AgentNode";
import { NodeConfigPanel } from "../components/run/NodeConfigPanel";
import { Button } from "../components/ui/Button";
import { useLoopSpec, useUpdateLoopSpec } from "../lib/api/loopspecs";
import { useCreateTemplate } from "../lib/api/templates";
import { useGoal } from "../lib/api/goals";
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

  const { data: goal } = useGoal(spec?.goal_id ?? "");
  const createTemplate = useCreateTemplate();
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const onNodeClick: NodeMouseHandler = (_e, node) => setSelectedId(node.id);

  const selected = nodes.find((n) => n.id === selectedId);
  const internetAllowed = goal?.toggles.internet ?? false;

  function patchSelected(partial: Partial<BuilderNodeData>) {
    setNodes((ns) =>
      ns.map((n) => (n.id === selectedId ? { ...n, data: { ...n.data, ...partial } } : n)),
    );
  }

  function toggleTool(tool: string) {
    if (!selected) return;
    const has = selected.data.tools.includes(tool);
    patchSelected({
      tools: has
        ? selected.data.tools.filter((t) => t !== tool)
        : [...selected.data.tools, tool],
    });
  }

  function deleteSelected() {
    if (!selectedId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedId));
    setEdges((es) => es.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
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

  async function saveAsTemplate() {
    await createTemplate.mutateAsync({ name: `Template — ${spec?.id ?? specId}`, spec_id: specId });
    navigate("/templates");
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
        <Button variant="secondary" size="sm" onClick={addAgent}>
          + Add agent
        </Button>
        <Button variant="secondary" size="sm" onClick={saveAsTemplate} loading={createTemplate.isPending}>
          ⧉ Save as template
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/specs/${specId}`)}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={errors.length > 0} loading={update.isPending}>
          Save spec
        </Button>
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
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedId(null)}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={26} size={1.1} color="rgba(38,37,30,0.13)" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor="#f54e00" style={{ background: "#fafaf7", border: "1px solid rgba(38,37,30,.11)" }} />
          </ReactFlow>
        </div>

        <aside className="overflow-auto border-l border-[var(--line)] p-5">
          {selected ? (
            <NodeConfigPanel
              name={selected.data.name}
              role={selected.data.role}
              systemPrompt={selected.data.systemPrompt}
              tools={selected.data.tools}
              internetAllowed={internetAllowed}
              onRole={(v) => patchSelected({ role: v })}
              onPrompt={(v) => patchSelected({ systemPrompt: v })}
              onToggleTool={toggleTool}
              onDelete={deleteSelected}
            />
          ) : null}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mut">
            Validation
          </h3>
          {errors.length === 0 ? (
            <div className="rounded-xl border border-[color-mix(in_srgb,var(--ok)_32%,var(--line))] bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface))] px-3.5 py-3 text-[13px] font-semibold text-ok">
              ✓ Graph is valid — ready to save.
            </div>
          ) : (
            <div className="space-y-2.5">
              {errors.map((e, i) => (
                <div
                  key={`${e.code}-${i}`}
                  className="rounded-xl border border-[color-mix(in_srgb,var(--bad)_38%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_10%,var(--surface))] px-3.5 py-2.5 text-[12.5px] text-bad"
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
