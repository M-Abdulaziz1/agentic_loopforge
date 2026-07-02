import { Link, useNavigate } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useGoals } from "../lib/api/goals";
import type { RunStatus } from "../lib/api/types";

type BadgeTone = "neutral" | "brand" | "ok" | "warn" | "bad";
const STATUS_TONE: Partial<Record<RunStatus, BadgeTone>> = {
  completed: "ok",
  running: "brand",
  needs_clarification: "warn",
  pending_approval: "warn",
};

export function GoalsListPage() {
  const navigate = useNavigate();
  const { data: goals = [], isLoading } = useGoals();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-end gap-4 border-b border-[var(--line)] px-8 py-6">
        <div>
          <div className="lf-eyebrow">Build</div>
          <h1 className="mt-1.5 font-display text-[32px] leading-none text-ink">Goals</h1>
        </div>
        <Button className="ml-auto" onClick={() => navigate("/goals/new")}>
          New goal
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[1200px] flex-1 overflow-auto p-8">
        {isLoading ? (
          <div className="text-mut">Loading goals…</div>
        ) : goals.length === 0 ? (
          <div className="grid place-items-center py-24 text-center">
            <div className="font-display text-[26px] text-ink">No goals yet</div>
            <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-mut">
              Describe an end goal and LoopForge will turn it into a guarded agent loop.
            </p>
            <Button className="mt-6" size="lg" onClick={() => navigate("/goals/new")}>
              Create your first goal
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5">
            {goals.map((g) => (
              <Link key={g.id} to={`/goals/${g.id}/clarify`} className="group">
                <GlassCard className="h-full transition group-hover:-translate-y-0.5 group-hover:border-[var(--line2)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-mono text-[12px] text-mut">{g.id}</span>
                    <Badge className="ml-auto" tone={STATUS_TONE[g.status] ?? "neutral"}>
                      {g.status}
                    </Badge>
                  </div>
                  <div className="text-[15px] leading-relaxed text-ink">{g.text}</div>
                  <div className="mt-3 border-t border-[var(--line)] pt-3 font-mono text-[11px] uppercase tracking-[.5px] text-mut">
                    {g.mode}
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
