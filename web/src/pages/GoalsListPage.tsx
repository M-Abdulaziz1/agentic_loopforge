import { Link, useNavigate } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { useDeleteGoal, useGoals } from "../lib/api/goals";
import type { Goal, RunStatus } from "../lib/api/types";

const STATUS_STYLE: Partial<Record<RunStatus, string>> = {
  completed: "bg-[rgba(70,227,173,.14)] text-[#9af3d4]",
  running: "bg-[var(--accent-soft)] text-[var(--accent)]",
  needs_clarification: "bg-[rgba(255,209,102,.15)] text-[#ffe2a0]",
  pending_approval: "bg-[rgba(255,209,102,.15)] text-[#ffe2a0]",
};

export function GoalsListPage() {
  const navigate = useNavigate();
  const { data: goals = [], isLoading } = useGoals();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="text-base font-bold text-ink">Goals</h1>
        <button
          type="button"
          onClick={() => navigate("/goals/new")}
          className="ml-auto rounded-xl bg-[var(--accent)] px-4 py-2 text-[13px] font-bold text-white"
        >
          + New goal
        </button>
      </div>

      <div className="flex-1 overflow-auto p-7">
        {isLoading ? (
          <div className="text-mut">Loading goals…</div>
        ) : goals.length === 0 ? (
          <div className="grid place-items-center py-20 text-center">
            <div className="text-lg font-bold">No goals yet</div>
            <p className="mt-2 max-w-sm text-sm text-mut">
              Describe an end goal and LoopForge will turn it into a guarded agent loop.
            </p>
            <button
              type="button"
              onClick={() => navigate("/goals/new")}
              className="mt-5 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white"
            >
              + Create your first goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalCard({ goal: g }: { goal: Goal }) {
  const deleteGoal = useDeleteGoal();

  function onDelete(e: React.MouseEvent) {
    // The card is a link; keep the delete button from navigating.
    e.preventDefault();
    e.stopPropagation();
    if (deleteGoal.isPending) return;
    const ok = window.confirm(
      "Delete this goal? This also removes its loop specs and any runs. This cannot be undone.",
    );
    if (ok) deleteGoal.mutate(g.id);
  }

  return (
    <Link to={`/goals/${g.id}/clarify`}>
      <GlassCard className="transition hover:border-[var(--line2)]">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-[12px] text-mut">{g.id}</span>
          <span
            className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold ${
              STATUS_STYLE[g.status] ?? "bg-[var(--glass2)] text-ink2"
            }`}
          >
            {g.status}
          </span>
          <button
            type="button"
            aria-label={`Delete goal ${g.id}`}
            onClick={onDelete}
            disabled={deleteGoal.isPending}
            className="rounded-md border border-[var(--line2)] bg-[var(--glass2)] px-2 py-0.5 text-[11px] font-semibold text-mut transition hover:border-[rgba(255,107,154,.5)] hover:text-[#ffd0e0] disabled:opacity-40"
          >
            {deleteGoal.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
        <div className="text-[14px] leading-relaxed text-ink">{g.text}</div>
        <div className="mt-2 text-[12px] text-mut">{g.mode}</div>
        {deleteGoal.isError ? (
          <div className="mt-2 rounded-md bg-[rgba(255,107,154,.14)] px-2 py-1 text-[11px] text-[#ffd0e0]">
            Could not delete this goal. Try again.
          </div>
        ) : null}
      </GlassCard>
    </Link>
  );
}
