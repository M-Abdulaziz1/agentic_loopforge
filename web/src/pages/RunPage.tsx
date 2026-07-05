import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "../lib/cn";
import { useUiStore } from "../store/ui";
import { useCancelRun, usePauseRun, useRun, useRunEvents, useStartRun } from "../lib/api/runs";
import { ApiError } from "../lib/api/client";
import { useLoopSpec } from "../lib/api/loopspecs";
import { useGoal } from "../lib/api/goals";
import { useGates, useDecideGate } from "../lib/api/gates";
import { reduceRunEvents } from "../lib/runEvents";
import { MeterBar } from "../components/ui/MeterBar";
import { AgentPipeline } from "../components/run/AgentPipeline";
import { Inspector } from "../components/run/Inspector";
import type { RunEvent, RunEventType } from "../lib/api/types";

const TABS = [
  { id: "canvas", label: "Agents" },
  { id: "events", label: "Events" },
] as const;

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
  const { data: pendingGates = [] } = useGates("pending");

  const agentNames = spec?.agents.map((a) => a.name) ?? [];
  const view = reduceRunEvents(events, agentNames, run?.status);
  const gate =
    pendingGates.find((g) => g.id === view.pendingGate?.gateId) ??
    pendingGates.find((g) => g.run_id === runId);
  const decide = useDecideGate(view.pendingGate?.gateId ?? gate?.id ?? "", runId);

  if (isLoading || !run) return <div className="p-8 text-mut">Loading run…</div>;

  const budget = goal?.budget;
  const isLive = run.status === "running";
  const selectedAgent = spec?.agents.find((a) => a.name === selectedAgentId);
  const incoming =
    spec?.handoffs.filter((h) => h.to === selectedAgentId).map((h) => h.from) ?? [];
  const outgoing =
    spec?.handoffs.filter((h) => h.from === selectedAgentId).map((h) => h.to) ?? [];
  const recent = selectedAgentId ? (view.eventsByAgent[selectedAgentId] ?? []) : [];
  const inspectorGate = view.pendingGate
    ? { gateType: view.pendingGate.gateType, context: gate?.context ?? {} }
    : null;

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
        {isLive ? (
          <PauseCancel runId={runId} disabled={!isLive} />
        ) : (
          <RunActions goalId={run.goal_id} specId={run.loop_spec_id} />
        )}
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
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-[12.5px] font-semibold transition",
                tab === t.id
                  ? "bg-[var(--accent-soft)] text-white"
                  : "text-mut hover:text-ink",
              )}
            >
              {t.label}
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
              <AgentPipeline
                agents={spec.agents}
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
        <Inspector
          agent={selectedAgent}
          agentStatus={selectedAgent ? view.agentStatus[selectedAgent.name] : undefined}
          incoming={incoming}
          outgoing={outgoing}
          recent={recent}
          gate={inspectorGate}
          deciding={decide.isPending}
          onApprove={() => decide.mutate({ decision: "approve" })}
          onReject={() => decide.mutate({ decision: "reject" })}
        />
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

function RunActions({ goalId, specId }: { goalId: string; specId: string }) {
  const navigate = useNavigate();
  const rerun = useStartRun(goalId);

  function onRerun() {
    // Rerun = start a fresh run from the same (already-approved) loop spec.
    rerun.mutate(specId, {
      onSuccess: (run) => navigate(`/runs/${run.id}`),
    });
  }

  return (
    <>
      <Link
        to={`/specs/${specId}/edit`}
        className="rounded-xl border border-[var(--line2)] bg-[var(--glass2)] px-4 py-2 text-[13px] font-semibold text-ink2 transition hover:border-[var(--line2)]"
      >
        ✎ Edit loop
      </Link>
      <button
        type="button"
        disabled={rerun.isPending}
        onClick={onRerun}
        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
      >
        {rerun.isPending ? "Starting…" : "↻ Rerun"}
      </button>
      {rerun.isError ? (
        <span className="max-w-[220px] rounded-lg bg-[rgba(255,107,154,.14)] px-2.5 py-1 text-[11.5px] text-[#ffd0e0]">
          {rerunErrorMessage(rerun.error)}
        </span>
      ) : null}
    </>
  );
}

function rerunErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 409)
    return "The loop spec must be approved before it can run. Edit and re-approve it first.";
  return "Could not start the run. Try again.";
}

const TAG_STYLE: Record<RunEventType, string> = {
  node_start: "bg-[rgba(70,227,173,.18)] text-[#bff5e3]",
  node_end: "bg-[rgba(70,227,173,.18)] text-[#bff5e3]",
  tool_call: "bg-[var(--accent-soft)] text-[var(--accent)]",
  llm_call: "bg-[var(--accent-soft)] text-[var(--accent)]",
  cost_update: "bg-[var(--glass2)] text-mut",
  gate_pending: "bg-[rgba(255,209,102,.2)] text-[#ffe7ad]",
  run_status: "bg-[var(--glass2)] text-ink2",
};

function EventLog({ events }: { events: RunEvent[] }) {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  return (
    <div className="p-4">
      <div className="flex flex-col" role="log" aria-live="polite" aria-label="Run events">
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
