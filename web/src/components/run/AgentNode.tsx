import { Handle, Position, type NodeProps } from "reactflow";
import { cn } from "../../lib/cn";
import type { AgentNodeData } from "../../lib/buildAgentFlow";

const GLYPH: Record<string, string> = {
  planner: "◈",
  analyst: "⚗",
  validator: "✺",
  reporter: "▤",
};

const STATUS_PILL: Record<AgentNodeData["status"], string> = {
  running: "bg-[color-mix(in_srgb,var(--violet)_16%,var(--surface))] text-violet",
  done: "bg-[color-mix(in_srgb,var(--ok)_14%,var(--surface))] text-ok",
  idle: "bg-[var(--glass2)] text-mut",
};

export function AgentNode({ data }: NodeProps<AgentNodeData>) {
  const { name, role, status, tools, selected } = data;
  return (
    <div
      className={cn(
        "w-[212px] rounded-xl border bg-[var(--surface)] p-3.5 transition",
        selected
          ? "border-violet shadow-[0_0_0_1px_var(--violet)]"
          : status === "running"
            ? "border-[color-mix(in_srgb,var(--tl-think)_60%,var(--line))]"
            : "border-[var(--line2)]",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-violet !bg-surface" />
      <div className="mb-2.5 flex items-center gap-2.5">
        <div
          className={cn(
            "grid size-9 place-items-center rounded-xl text-base",
            status === "done"
              ? "bg-[color-mix(in_srgb,var(--ok)_15%,var(--surface))] text-ok"
              : status === "idle"
                ? "bg-[var(--glass2)] text-mut"
                : "bg-violet text-white",
            status === "running" && "animate-pulse",
          )}
        >
          {GLYPH[name] ?? "◆"}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{name}</div>
          <div className="truncate text-[11px] text-mut">{role}</div>
        </div>
        <span
          className={cn(
            "ml-auto rounded-md px-2 py-0.5 text-[9.5px] font-extrabold tracking-[.5px]",
            STATUS_PILL[status],
          )}
        >
          {status.toUpperCase()}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tools.map((t) => (
          <span
            key={t}
            className="rounded-md border border-[var(--line2)] bg-[var(--glass2)] px-2 py-0.5 text-[10px] text-ink2"
          >
            {t}
          </span>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-violet !bg-surface" />
    </div>
  );
}
