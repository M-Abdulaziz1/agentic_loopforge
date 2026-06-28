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
  running: "bg-[rgba(138,108,255,.32)] text-[#e3daff]",
  done: "bg-[rgba(70,227,173,.2)] text-[#bff5e3]",
  idle: "bg-[var(--glass2)] text-mut",
};

export function AgentNode({ data }: NodeProps<AgentNodeData>) {
  const { name, role, status, tools, selected } = data;
  return (
    <div
      className={cn(
        "w-[212px] rounded-2xl border bg-gradient-to-b from-white/[0.07] to-white/[0.03] p-3.5 backdrop-blur-md transition",
        selected
          ? "border-teal shadow-[0_0_0_1.5px_var(--teal),0_0_40px_rgba(74,214,255,.4)]"
          : status === "running"
            ? "border-[#cdbcff] shadow-[0_0_0_1px_rgba(205,188,255,.5),0_0_36px_rgba(138,108,255,.45)]"
            : "border-[var(--line2)]",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-teal !bg-bg0" />
      <div className="mb-2.5 flex items-center gap-2.5">
        <div
          className={cn(
            "grid size-9 place-items-center rounded-xl text-base",
            status === "done"
              ? "bg-[rgba(70,227,173,.22)] text-ok"
              : status === "idle"
                ? "bg-[var(--glass2)] text-mut"
                : "bg-gradient-to-br from-[rgba(138,108,255,.55)] to-[rgba(74,214,255,.42)]",
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
            className="rounded-md border border-[rgba(74,214,255,.25)] bg-[rgba(74,214,255,.15)] px-2 py-0.5 text-[10px] text-[#c4eeff]"
          >
            {t}
          </span>
        ))}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2 !border-teal !bg-bg0" />
    </div>
  );
}
