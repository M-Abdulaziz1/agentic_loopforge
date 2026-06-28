import { useParams } from "react-router-dom";
import { cn } from "../lib/cn";
import { useUiStore } from "../store/ui";
import { useCancelRun, usePauseRun, useRun, useRunEvents } from "../lib/api/runs";
import { useLoopSpec } from "../lib/api/loopspecs";
import { useGoal } from "../lib/api/goals";
import { reduceRunEvents } from "../lib/runEvents";
import { MeterBar } from "../components/ui/MeterBar";
import { AgentCanvas } from "../components/run/AgentCanvas";
import type { RunEvent, RunEventType } from "../lib/api/types";

const TABS = ["canvas", "timeline", "events"] as const;

export function RunPage() {
  const { runId = "" } = useParams();
  const tab = useUiStore((s) => s.activeRunTab);
  const setTab = useUiStore((s) => s.setActiveRunTab);
  const selectedAgentId = useUiStore((s) => s.selectedAgentId);
  const setSelectedAgent = useUiStore((s) => s.setSelectedAgent);

  const { data: run, isLoading } = useRun(runId);
  const { data: spec } = useLoopSpec(run?.loop_spec_id ?? "");
  const { data: goal } = useGoal(run?.goal_id ?? "");
  const { data: events = [] } = useRunEvents(runId, run?.status === "running");

  if (isLoading || !run) return <div className="p-8 text-mut">Loading run…</div>;

  const agentNames = spec?.agents.map((a) => a.name) ?? [];
  const view = reduceRunEvents(events, agentNames);
  const budget = goal?.budget;
  const isLive = run.status === "running";

  return (
    <div className="flex min-h-screen flex-col overflow-hidden">
      {/* top bar */}
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-6 py-4">
        <div className="text-sm text-mut">
          Runs / <b className="text-ink">{goal ? truncate(goal.text, 32) : "Run"}</b>{" "}
          <span className="font-mono text-mut">{run.id}</span>
        </div>
        <StatusPill status={run.status} live={isLive} />
        <div className="flex-1" />
        <PauseCancel runId={runId} disabled={!isLive} />
      </div>

      {/* meter rail + tabs */}
      <div className="flex items-center gap-6 border-b border-[var(--line)] bg-white/[0.015] px-6 py-3">
        <MeterBar
          label="STEPS"
          value={`${run.spent_steps} / ${budget?.max_steps ?? "–"}`}
          fraction={budget ? run.spent_steps / budget.max_steps : 0}
        />
        <MeterBar
          label="LLM CALLS"
          value={`${run.spent_llm_calls} / ${budget?.max_llm_calls ?? "–"}`}
          fraction={budget ? run.spent_llm_calls / budget.max_llm_calls : 0}
        />
        <MeterBar
          label="CONTEXT"
          value={`${fmtTok(view.meters.contextTokens)} / ${fmtTok(budget?.max_context_tokens)}`}
          fraction={
            budget && view.meters.contextTokens
              ? view.meters.contextTokens / budget.max_context_tokens
              : 0
          }
          warn
        />
        {view.meters.spentUsd !== undefined ? (
          <MeterBar label="COST" value={`$${view.meters.spentUsd.toFixed(2)}`} fraction={0} />
        ) : null}
        <div className="ml-auto flex gap-1 rounded-xl border border-[var(--line)] bg-[var(--glass)] p-1">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-[12.5px] font-semibold capitalize",
                tab === t
                  ? "bg-gradient-to-br from-[rgba(138,108,255,.4)] to-[rgba(74,214,255,.3)] text-white"
                  : "text-mut hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* stage */}
      <div className="grid flex-1 grid-cols-[1fr_340px] overflow-hidden">
        <div className="relative overflow-hidden">
          {tab === "events" ? (
            <div className="h-full overflow-auto">
              <EventLog events={events} />
            </div>
          ) : tab === "canvas" ? (
            spec ? (
              <AgentCanvas
                agents={spec.agents}
                handoffs={spec.handoffs}
                view={view}
                selectedId={selectedAgentId}
                onSelect={setSelectedAgent}
              />
            ) : (
              <div className="grid h-full place-items-center text-mut">Loading agents…</div>
            )
          ) : (
            <div className="grid h-full place-items-center text-mut">Timeline — coming next</div>
          )}
        </div>
        <aside className="overflow-auto border-l border-[var(--line)] p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-mut">
            Inspector
          </h3>
          <p className="text-[13px] leading-relaxed text-ink2">
            {view.pendingGate
              ? `Gate pending · ${view.pendingGate.gateType}`
              : "Select an agent on the canvas to inspect it."}
          </p>
        </aside>
      </div>
    </div>
  );
}

function StatusPill({ status, live }: { status: string; live: boolean }) {
  return (
    <span
      data-testid="run-status"
      className={cn(
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold tracking-[.3px]",
        live
          ? "border-[rgba(70,227,173,.3)] bg-[rgba(70,227,173,.1)] text-[#9af3d4]"
          : "border-[var(--line2)] bg-[var(--glass)] text-ink2",
      )}
    >
      {live ? <span className="size-2 rounded-full bg-ok" /> : null}
      {status.toUpperCase()}
    </span>
  );
}

function PauseCancel({ runId, disabled }: { runId: string; disabled: boolean }) {
  const pause = usePauseRun(runId);
  const cancel = useCancelRun(runId);
  return (
    <>
      <button
        type="button"
        disabled={disabled || pause.isPending}
        onClick={() => pause.mutate()}
        className="rounded-xl border border-[var(--line2)] bg-[var(--glass2)] px-4 py-2 text-[13px] font-semibold disabled:opacity-40"
      >
        ❚❚ Pause
      </button>
      <button
        type="button"
        disabled={disabled || cancel.isPending}
        onClick={() => cancel.mutate()}
        className="rounded-xl border border-[rgba(255,107,154,.4)] bg-[rgba(255,107,154,.13)] px-4 py-2 text-[13px] font-semibold text-[#ffd0e0] disabled:opacity-40"
      >
        ■ Cancel run
      </button>
    </>
  );
}

const TAG_STYLE: Record<RunEventType, string> = {
  node_start: "bg-[rgba(70,227,173,.18)] text-[#bff5e3]",
  node_end: "bg-[rgba(70,227,173,.18)] text-[#bff5e3]",
  tool_call: "bg-[rgba(74,214,255,.18)] text-[#c4eeff]",
  llm_call: "bg-[rgba(138,108,255,.22)] text-[#e3daff]",
  cost_update: "bg-[var(--glass2)] text-mut",
  gate_pending: "bg-[rgba(255,209,102,.2)] text-[#ffe7ad]",
  run_status: "bg-[var(--glass2)] text-ink2",
};

function EventLog({ events }: { events: RunEvent[] }) {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  return (
    <div className="p-4">
      <div className="flex flex-col">
        {ordered.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] hover:bg-[var(--glass)]"
          >
            <span className="min-w-[64px] font-mono text-[11px] text-mut">
              {e.created_at.slice(11, 19)}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-extrabold tracking-[.4px]",
                TAG_STYLE[e.type],
              )}
            >
              {e.type.replace("_", " ").toUpperCase()}
            </span>
            <span className="text-ink2">{e.message}</span>
          </div>
        ))}
        {ordered.length === 0 ? <div className="p-4 text-mut">No events yet.</div> : null}
      </div>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function fmtTok(n?: number) {
  if (n === undefined) return "–";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
