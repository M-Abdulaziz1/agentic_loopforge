import { cn } from "../../lib/cn";
import type { AgentStatus, RunView } from "../../lib/runEvents";
import type { LoopSpecAgent } from "../../lib/api/types";

type Props = {
  agents: LoopSpecAgent[];
  view: RunView;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

type SegState = "idle" | "active" | "done";

function monogram(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.trim()[0] ?? "?").toUpperCase();
}

function segmentState(a: AgentStatus, b: AgentStatus): SegState {
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
  const lastStatus = agents.length ? statusOf(agents[agents.length - 1].name) : "idle";
  const endState: SegState =
    lastStatus === "done" ? "done" : lastStatus === "running" ? "active" : "idle";

  return (
    <div
      className="flex h-full flex-col"
      style={{
        backgroundImage:
          "radial-gradient(760px 460px at 50% -12%, rgba(138,108,255,.16), transparent 62%)," +
          "linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)",
        backgroundSize: "auto, 34px 34px, 34px 34px",
      }}
    >
      {/* header / legend */}
      <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[rgba(8,8,26,.5)] px-6 py-3 backdrop-blur-md">
        <span className="text-[11px] font-bold uppercase tracking-[1.6px] text-mut">
          Agent pipeline
        </span>
        <span className="rounded-md bg-[var(--glass2)] px-2 py-0.5 font-mono text-[11px] text-ink2">
          {agents.length} {agents.length === 1 ? "agent" : "agents"}
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

      {/* stage — vertically + horizontally centered so it reads as a diagram, not a jammed row */}
      <div className="min-h-0 flex-1 overflow-auto" onClick={() => onSelect(null)}>
        <div className="flex min-h-full min-w-min items-center justify-center px-12 py-10">
          <div className="flex items-start">
            <RailCap label="Goal" tone="done" side="start" />
            {agents.map((agent, i) => {
              const status = statusOf(agent.name);
              const leftState: SegState =
                i > 0 ? segmentState(statusOf(agents[i - 1].name), status) : "done";
              const rightState: SegState =
                i < agents.length - 1
                  ? segmentState(status, statusOf(agents[i + 1].name))
                  : endState;

              return (
                <Station
                  key={agent.name}
                  agent={agent}
                  status={status}
                  index={i}
                  selected={agent.name === selectedId}
                  leftState={leftState}
                  rightState={rightState}
                  onSelect={onSelect}
                />
              );
            })}
            <RailCap label="Result" tone={endState} side="end" />
          </div>
        </div>
      </div>
    </div>
  );
}

const RAIL_H = "h-[60px]";

function Station({
  agent,
  status,
  index,
  selected,
  leftState,
  rightState,
  onSelect,
}: {
  agent: LoopSpecAgent;
  status: AgentStatus;
  index: number;
  selected: boolean;
  leftState: SegState;
  rightState: SegState;
  onSelect: (id: string | null) => void;
}) {
  const stubTone =
    status === "done" ? "bg-gradient-to-b from-teal to-ok" : status === "running" ? "bg-gradient-to-b from-violet to-teal" : "bg-[var(--line2)]";

  return (
    <div
      className="lf-rise flex w-[212px] shrink-0 flex-col items-center"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      {/* orb rail with connecting conduits */}
      <div className={cn("relative flex w-full items-center justify-center", RAIL_H)}>
        <span className={cn("lf-conduit absolute left-0 top-1/2 w-1/2 -translate-y-1/2", CONDUIT[leftState])} />
        <span className={cn("lf-conduit absolute right-0 top-1/2 w-1/2 -translate-y-1/2", CONDUIT[rightState])} />
        <AgentOrb name={agent.name} status={status} selected={selected} index={index} />
      </div>

      {/* vertical drop that fuses the orb to its card */}
      <span className={cn("h-[18px] w-[2.5px] rounded", stubTone)} />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(selected ? null : agent.name);
        }}
        className={cn(
          "w-[200px] rounded-2xl border p-3.5 text-left backdrop-blur-md transition",
          selected
            ? "border-teal bg-[rgba(74,214,255,.06)] shadow-[0_0_0_1px_var(--teal),0_16px_44px_rgba(74,214,255,.2)]"
            : status === "running"
              ? "border-[rgba(205,188,255,.5)] bg-white/[0.045] shadow-[0_14px_40px_rgba(138,108,255,.24)]"
              : "border-[var(--line)] bg-white/[0.028] hover:-translate-y-0.5 hover:border-[var(--line2)] hover:bg-white/[0.05]",
        )}
      >
        <div className="flex items-center gap-2">
          <div className="truncate font-display text-[15px] font-bold text-ink">{agent.name}</div>
          <StatusTag status={status} />
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-[32px] text-[12px] leading-relaxed text-mut">
          {agent.role}
        </p>
        {agent.tools.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-2.5">
            {agent.tools.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-md border border-[rgba(74,214,255,.22)] bg-[rgba(74,214,255,.1)] px-1.5 py-0.5 font-mono text-[10px] text-[#c4eeff]"
              >
                {t}
              </span>
            ))}
            {agent.tools.length > 3 ? (
              <span className="rounded-md bg-[var(--glass2)] px-1.5 py-0.5 font-mono text-[10px] text-mut">
                +{agent.tools.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
      </button>
    </div>
  );
}

function RailCap({ label, tone, side }: { label: string; tone: SegState; side: "start" | "end" }) {
  return (
    <div className="flex w-[74px] shrink-0 flex-col items-center">
      <div className={cn("relative flex w-full items-center justify-center", RAIL_H)}>
        {side === "end" ? (
          <span className={cn("lf-conduit absolute left-0 top-1/2 w-1/2 -translate-y-1/2", CONDUIT[tone])} />
        ) : (
          <span className={cn("lf-conduit absolute right-0 top-1/2 w-1/2 -translate-y-1/2", CONDUIT[tone])} />
        )}
        <span
          className={cn(
            "relative z-10 grid size-8 place-items-center rounded-full border",
            tone === "done"
              ? "border-[rgba(70,227,173,.5)] bg-[rgba(70,227,173,.14)] text-ok"
              : tone === "active"
                ? "border-[rgba(74,214,255,.5)] bg-[rgba(74,214,255,.12)] text-teal"
                : "border-[var(--line2)] bg-[var(--glass)] text-mut",
          )}
        >
          {side === "start" ? "◆" : "◇"}
        </span>
      </div>
      <span className="mt-2 text-[10px] font-bold uppercase tracking-[1px] text-mut">{label}</span>
    </div>
  );
}

const DOT: Record<AgentStatus, string> = {
  idle: "bg-[var(--line2)]",
  running: "bg-violet shadow-[0_0_8px_var(--violet)]",
  done: "bg-ok shadow-[0_0_8px_var(--ok)]",
};

const CONDUIT: Record<SegState, string> = {
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
    <div className="relative z-10 grid size-[56px] place-items-center">
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
          "grid size-[56px] place-items-center rounded-full border text-[16px] font-bold transition",
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
      <span className="absolute -bottom-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border border-[var(--line2)] bg-bg0 px-1 font-mono text-[10px] font-bold text-mut">
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
