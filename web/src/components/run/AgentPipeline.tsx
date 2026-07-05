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

const LEGEND: { label: string; status: AgentStatus }[] = [
  { label: "Idle", status: "idle" },
  { label: "Running", status: "running" },
  { label: "Done", status: "done" },
];

export function AgentPipeline({ agents, view, selectedId, onSelect }: Props) {
  const statusOf = (name: string): AgentStatus => view.agentStatus[name] ?? "idle";
  const doneCount = agents.filter((a) => statusOf(a.name) === "done").length;

  return (
    <div
      className="flex h-full flex-col"
      style={{
        backgroundImage:
          "radial-gradient(820px 500px at 50% -14%, rgba(138,108,255,.16), transparent 62%)," +
          "radial-gradient(600px 400px at 100% 110%, rgba(74,214,255,.08), transparent 60%)," +
          "linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)",
        backgroundSize: "auto, auto, 36px 36px, 36px 36px",
      }}
    >
      {/* header: title + segmented progress + legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line)] bg-[rgba(8,8,26,.5)] px-6 py-3 backdrop-blur-md">
        <span className="text-[11px] font-bold uppercase tracking-[1.6px] text-mut">Agent modules</span>
        <span className="rounded-md bg-[var(--glass2)] px-2 py-0.5 font-mono text-[11px] text-ink2">
          {agents.length}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {agents.map((a, i) => (
              <span
                key={a.name}
                className={cn("h-1.5 w-6 rounded-full transition", SEG[statusOf(a.name)])}
                style={{ transitionDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] text-mut">
            {doneCount}/{agents.length}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3.5">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-[11px] text-mut">
              <span className={cn("size-2 rounded-full", DOT[l.status])} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* modular grid — self-contained tiles, no linear rail */}
      <div className="min-h-0 flex-1 overflow-auto" onClick={() => onSelect(null)}>
        <div className="flex min-h-full items-center justify-center p-8">
          <div
            className="grid w-full max-w-[980px] gap-5"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
          >
            {agents.map((agent, i) => (
              <AgentModule
                key={agent.name}
                agent={agent}
                status={statusOf(agent.name)}
                index={i}
                activity={view.eventsByAgent[agent.name]?.length ?? 0}
                selected={agent.name === selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const SEG: Record<AgentStatus, string> = {
  idle: "bg-[var(--line2)]",
  running: "bg-[var(--accent)]",
  done: "bg-ok",
};

const DOT: Record<AgentStatus, string> = {
  idle: "bg-[var(--line2)]",
  running: "bg-violet shadow-[0_0_8px_var(--violet)]",
  done: "bg-ok shadow-[0_0_8px_var(--ok)]",
};

function AgentModule({
  agent,
  status,
  index,
  activity,
  selected,
  onSelect,
}: {
  agent: LoopSpecAgent;
  status: AgentStatus;
  index: number;
  activity: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected ? null : agent.name);
      }}
      style={{ animationDelay: `${index * 80}ms` }}
      className={cn(
        "lf-rise group relative flex flex-col overflow-hidden rounded-3xl border p-5 text-left backdrop-blur-md transition duration-200",
        selected
          ? "border-teal bg-[var(--accent-soft)]"
          : status === "running"
            ? "border-[var(--line2)] bg-white/[0.045]"
            : status === "done"
              ? "border-[var(--line2)] bg-white/[0.03] hover:-translate-y-1 hover:border-[rgba(70,227,173,.4)] hover:shadow-[0_20px_48px_rgba(70,227,173,.14)]"
              : "border-[var(--line)] bg-white/[0.02] hover:-translate-y-1 hover:border-[var(--line2)] hover:",
      )}
    >
      {/* status accent bar */}
      <span className={cn("absolute inset-x-0 top-0 h-[3px]", ACCENT[status])} />

      {/* header */}
      <div className="flex items-start gap-3">
        <Tile name={agent.name} status={status} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[16px] font-bold text-ink">{agent.name}</div>
          <div className="truncate text-[12px] text-mut">{agent.role}</div>
        </div>
        <StatusTag status={status} />
      </div>

      {/* body: the module's charter */}
      <p className="mt-3.5 line-clamp-3 min-h-[54px] text-[12.5px] leading-relaxed text-ink2">
        {agent.system_prompt}
      </p>

      {/* tools */}
      {agent.tools.length > 0 ? (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {agent.tools.slice(0, 4).map((t) => (
            <span
              key={t}
              className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent)]"
            >
              {t}
            </span>
          ))}
          {agent.tools.length > 4 ? (
            <span className="rounded-md bg-[var(--glass2)] px-1.5 py-0.5 font-mono text-[10px] text-mut">
              +{agent.tools.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* footer meta */}
      <div className="mt-4 flex items-center gap-2 border-t border-[var(--line)] pt-3 text-[11px] text-mut">
        <span className="rounded-md bg-[var(--glass2)] px-1.5 py-0.5 font-mono text-[10px] text-ink2">
          M{String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full", DOT[status])} />
          {activity > 0 ? `${activity} event${activity === 1 ? "" : "s"}` : "no activity"}
        </span>
        <span className="ml-auto font-semibold text-mut transition group-hover:text-teal">
          Inspect →
        </span>
      </div>
    </button>
  );
}

const ACCENT: Record<AgentStatus, string> = {
  idle: "bg-[var(--line2)]",
  running: "bg-gradient-to-r from-violet via-teal to-violet [background-size:200%_100%] [animation:lf-shimmer_1.4s_linear_infinite]",
  done: "bg-gradient-to-r from-teal to-ok",
};

function Tile({ name, status }: { name: string; status: AgentStatus }) {
  return (
    <div className="relative grid size-12 shrink-0 place-items-center">
      <div
        className={cn(
          "grid size-12 place-items-center rounded-2xl border font-display text-[16px] font-bold transition",
          status === "done"
            ? "border-[rgba(70,227,173,.45)] bg-[rgba(70,227,173,.14)] text-ok"
            : status === "running"
              ? "border-transparent bg-[var(--accent)] text-white"
              : "border-[var(--line2)] bg-[var(--glass)] text-ink2",
        )}
      >
        {monogram(name)}
      </div>
      {status === "done" ? (
        <span className="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full border border-bg0 bg-ok text-[10px] font-bold text-[#04231a]">
          ✓
        </span>
      ) : null}
    </div>
  );
}

function StatusTag({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, string> = {
    idle: "bg-[var(--glass2)] text-mut",
    running: "bg-[var(--accent-soft)] text-[var(--accent)]",
    done: "bg-[rgba(70,227,173,.2)] text-[#bff5e3]",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[.5px]",
        map[status],
      )}
    >
      {status}
    </span>
  );
}
