import { Link, useNavigate } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { useGoals } from "../lib/api/goals";
import type { RunStatus } from "../lib/api/types";

const STATUS_STYLE: Partial<Record<RunStatus, string>> = {
  completed: "bg-[rgba(70,227,173,.14)] text-[#9af3d4]",
  running: "bg-[rgba(138,108,255,.2)] text-[#dcd0ff]",
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
          className="ml-auto rounded-xl bg-gradient-to-br from-violet to-teal px-4 py-2 text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(138,108,255,.3)]"
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
              className="mt-5 rounded-xl bg-gradient-to-br from-violet to-teal px-5 py-2.5 text-sm font-bold text-white"
            >
              + Create your first goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {goals.map((g) => (
              <Link key={g.id} to={`/goals/${g.id}/clarify`}>
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
                  </div>
                  <div className="text-[14px] leading-relaxed text-ink">{g.text}</div>
                  <div className="mt-2 text-[12px] text-mut">{g.mode}</div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
