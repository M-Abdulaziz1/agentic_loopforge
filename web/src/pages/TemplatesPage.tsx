import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { useGoals } from "../lib/api/goals";
import {
  useDeleteTemplate,
  useInstantiateTemplate,
  useTemplates,
} from "../lib/api/templates";

export function TemplatesPage() {
  const navigate = useNavigate();
  const { data: templates = [], isLoading } = useTemplates();
  const { data: goals = [] } = useGoals();
  const instantiate = useInstantiateTemplate();
  const del = useDeleteTemplate();
  const [goalId, setGoalId] = useState("");

  useEffect(() => {
    if (!goalId && goals.length) setGoalId(goals[0].id);
  }, [goals, goalId]);

  async function useTemplate(templateId: string) {
    if (!goalId) return;
    const spec = await instantiate.mutateAsync({ templateId, goalId });
    navigate(`/specs/${spec.id}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="text-base font-bold text-ink">Loop Templates</h1>
        <div className="ml-auto flex items-center gap-2 text-[12.5px] text-mut">
          <span>Instantiate into goal:</span>
          <select
            aria-label="Target goal"
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-2.5 py-1.5 text-ink"
          >
            {goals.map((g) => (
              <option key={g.id} value={g.id} className="bg-bg0">
                {g.id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-7">
        {isLoading ? (
          <div className="text-mut">Loading templates…</div>
        ) : templates.length === 0 ? (
          <div className="text-mut">No templates yet. Save one from the Loop Builder.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {templates.map((t) => (
              <GlassCard key={t.id} className="flex flex-col">
                <div className="text-base font-bold">{t.name}</div>
                {t.description ? (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-mut">{t.description}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.agents.map((a) => (
                    <span
                      key={a.name}
                      className="rounded-md border border-[var(--line)] bg-[var(--glass2)] px-2 py-0.5 text-[11px] text-ink2"
                    >
                      {a.name}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => useTemplate(t.id)}
                    disabled={!goalId || instantiate.isPending}
                    className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    Use template
                  </button>
                  <button
                    type="button"
                    onClick={() => del.mutate(t.id)}
                    disabled={del.isPending}
                    className="rounded-xl border border-[rgba(255,107,154,.35)] bg-[rgba(255,107,154,.12)] px-3 py-2 text-[13px] font-semibold text-[#ffd0e0]"
                  >
                    Delete
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
