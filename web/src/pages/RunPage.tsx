import { useParams } from "react-router-dom";
import { cn } from "../lib/cn";
import { useUiStore } from "../store/ui";
import { useCancelRun, usePauseRun, useRun, useRunEvents } from "../lib/api/runs";
import { useLoopSpec } from "../lib/api/loopspecs";
import { useGoal } from "../lib/api/goals";
import { useGates, useDecideGate } from "../lib/api/gates";
import { reduceRunEvents } from "../lib/runEvents";
import { MeterBar } from "../components/ui/MeterBar";
import { Button } from "../components/ui/Button";
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
        <PauseCancel runId={runId} disabled={!isLive} />
      </div>

      {/* meter rail + tabs */}
      <div className="flex items-center gap-6 border-b border-[var(--line)] bg-[var(--canvas-soft)] px-6 py-3">
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
        <div className="ml-auto flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-4 py-1.5 text-[12.5px] font-medium transition",
                tab === t.id
                  ? "bg-violet text-white"
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
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-[.3px]",
        live
          ? "border-[color-mix(in_srgb,var(--ok)_35%,var(--line))] bg-[color-mix(in_srgb,var(--ok)_12%,var(--surface))] text-ok"
          : "border-[var(--line2)] bg-[var(--surface)] text-ink2",
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
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled}
        loading={pause.isPending}
        onClick={() => pause.mutate()}
      >
        ❚❚ Pause
      </Button>
      <Button
        variant="danger"
        size="sm"
        disabled={disabled}
        loading={cancel.isPending}
        onClick={() => cancel.mutate()}
      >
        ■ Cancel run
      </Button>
    </>
  );
}

const TAG_STYLE: Record<RunEventType, string> = {
  node_start: "bg-tl-grep text-ink",
  node_end: "bg-tl-grep text-ink",
  tool_call: "bg-tl-read text-ink",
  llm_call: "bg-tl-edit text-ink",
  cost_update: "bg-[var(--glass2)] text-mut",
  gate_pending: "bg-tl-done text-white",
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
