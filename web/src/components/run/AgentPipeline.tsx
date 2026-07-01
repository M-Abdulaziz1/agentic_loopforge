import { cn } from "../../lib/cn";
import type { AgentStatus, RunView } from "../../lib/runEvents";
import type { LoopSpecAgent } from "../../lib/api/types";

type Props = {
  agents: LoopSpecAgent[];
  view: RunView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

function monogram(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.trim()[0] ?? "?").toUpperCase();
}

function segmentState(a: AgentStatus, b: AgentStatus): "idle" | "active" | "done" {
  if (a === "done" && b === "done") return "done";
  if (a === "done" && b === "running") return "active";
  if (a === "done") return "done";
  return "idle";
}

const LEGEND: { label: string; status: AgentStatus }[] = [
  { label: "Idle", status: "idle" },
  { label: "Running", status: "running" },
  { label: "Done", status: "done" },
];

export function AgentPipeline({ agents, view, selectedId, onSelect }: Props) {
  const statusOf = (name: string): AgentStatus => view.agentStatus[name] ?? "idle";

  return (
    <div
      className="relative size-full overflow-auto"
      onClick={() => onSelect(null)}
      style={{
        backgroundImage:
          "radial-gradient(700px 420px at 50% -10%, rgba(138,108,255,.16), transparent 60%)," +
          "linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)",
        backgroundSize: "auto, 34px 34px, 34px 34px",
      }}
    >
      {/* header / legend */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[var(--line)] bg-[rgba(8,8,26,.55)] px-6 py-3 backdrop-blur-md">
        <span className="text-[11px] font-bold uppercase tracking-[1.6px] text-mut">
          Agent pipeline
        </span>
        <span className="rounded-md bg-[var(--glass2)] px-2 py-0.5 font-mono text-[11px] text-ink2">
          {agents.length} agents
        </span>
        <div className="ml-auto flex items-center gap-3.5">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-mut">
              <span className={cn("size-2 rounded-full", DOT[l.status])} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* pipeline */}
      <div className="flex min-w-min justify-center px-10 py-12">
        <div className="flex items-stretch">
          {agents.map((agent, i) => {
            const status = statusOf(agent.name);
            const isSelected = agent.name === selectedId;
            const inSeg = i > 0 ? segmentState(statusOf(agents[i - 1].name), status) : null;
            const outSeg =
              i < agents.length - 1
                ? segmentState(status, statusOf(agents[i + 1].name))
                : null;

            return (
              <div
                key={agent.name}
                className="flex w-[228px] shrink-0 flex-col items-center lf-rise"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {/* rail: orb + connectors */}
                <div className="relative flex h-20 w-full items-center justify-center">
                  {inSeg ? (
                    <span
                      className={cn("lf-conduit absolute left-0 top-1/2 w-1/2 -translate-y-1/2", CONDUIT[inSeg])}
                    />
                  ) : null}
                  {outSeg ? (
                    <span
                      className={cn("lf-conduit absolute right-0 top-1/2 w-1/2 -translate-y-1/2", CONDUIT[outSeg])}
                    />
                  ) : null}
                  <AgentOrb name={agent.name} status={status} selected={isSelected} index={i} />
                </div>

                {/* card */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(isSelected ? null : agent.name);
                  }}
                  className={cn(
                    "mx-3 w-[204px] rounded-2xl border p-3.5 text-left backdrop-blur-md transition",
                    isSelected
                      ? "border-teal bg-[rgba(74,214,255,.06)] shadow-[0_0_0_1px_var(--teal),0_14px_40px_rgba(74,214,255,.18)]"
                      : status === "running"
                        ? "border-[rgba(205,188,255,.5)] bg-white/[0.04] shadow-[0_12px_36px_rgba(138,108,255,.22)]"
                        : "border-[var(--line)] bg-white/[0.025] hover:border-[var(--line2)] hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="truncate font-display text-[15px] font-bold text-ink">
                      {agent.name}
                    </div>
                    <StatusTag status={status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-mut">
                    {agent.role}
                  </p>
                  {agent.tools.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {agent.tools.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-md border border-[rgba(74,214,255,.22)] bg-[rgba(74,214,255,.1)] px-1.5 py-0.5 font-mono text-[10px] text-[#c4eeff]"
                        >
                          {t}
                        </span>
                      ))}
                      {agent.tools.length > 3 ? (
                        <span className="rounded-md bg-[var(--glass2)] px-1.5 py-0.5 text-[10px] text-mut">
                          +{agent.tools.length - 3}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const DOT: Record<AgentStatus, string> = {
  idle: "bg-[var(--line2)]",
  running: "bg-violet shadow-[0_0_8px_var(--violet)]",
  done: "bg-ok shadow-[0_0_8px_var(--ok)]",
};

const CONDUIT: Record<"idle" | "active" | "done", string> = {
  idle: "lf-conduit--idle",
  active: "lf-conduit--active",
  done: "lf-conduit--done",
};

function AgentOrb({
  name,
  status,
  selected,
  index,
}: {
  name: string;
  status: AgentStatus;
  selected: boolean;
  index: number;
}) {
  return (
    <div className="relative grid size-[58px] place-items-center">
      {/* orbiting ring while running */}
      {status === "running" ? (
        <span
          className="absolute inset-[-5px] rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent 0 70%, var(--teal) 90%, transparent 100%)",
            animation: "lf-orbit 1.8s linear infinite",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
          }}
        />
      ) : null}
      <div
        className={cn(
          "grid size-[58px] place-items-center rounded-full border text-[17px] font-bold transition",
          status === "done"
            ? "border-[rgba(70,227,173,.5)] bg-[rgba(70,227,173,.16)] text-ok"
            : status === "running"
              ? "border-transparent bg-gradient-to-br from-violet to-teal text-white shadow-[0_0_30px_rgba(138,108,255,.6)]"
              : "border-[var(--line2)] bg-[var(--glass)] text-ink2",
          selected && "ring-2 ring-teal ring-offset-2 ring-offset-bg0",
        )}
        style={status === "running" ? { animation: "lf-pulse 1.6s ease-in-out infinite" } : undefined}
      >
        {status === "done" ? "✓" : <span className="font-display">{monogram(name)}</span>}
      </div>
      {/* step index */}
      <span className="absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full border border-[var(--line2)] bg-bg0 px-1 font-mono text-[10px] font-bold text-mut">
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
}

function StatusTag({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, string> = {
    idle: "bg-[var(--glass2)] text-mut",
    running: "bg-[rgba(138,108,255,.28)] text-[#e3daff]",
    done: "bg-[rgba(70,227,173,.2)] text-[#bff5e3]",
  };
  return (
    <span
      className={cn(
        "ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[.5px]",
        map[status],
      )}
    >
      {status}
    </span>
  );
}
