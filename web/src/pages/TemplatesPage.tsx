import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Field";
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

  async function applyTemplate(templateId: string) {
    if (!goalId) return;
    const spec = await instantiate.mutateAsync({ templateId, goalId });
    navigate(`/specs/${spec.id}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="font-display text-[28px] leading-none text-ink">Loop Templates</h1>
        <div className="ml-auto flex items-center gap-2 text-[12.5px] text-mut">
          <span>Instantiate into goal:</span>
          <Select
            aria-label="Target goal"
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className="h-9 w-auto text-[13px]"
          >
            {goals.map((g) => (
              <option key={g.id} value={g.id} className="bg-surface text-ink">
                {g.id}
              </option>
            ))}
          </Select>
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
                <div className="font-display text-[18px] text-ink">{t.name}</div>
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
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => applyTemplate(t.id)}
                    disabled={!goalId}
                    loading={instantiate.isPending}
                  >
                    Use template
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => del.mutate(t.id)} loading={del.isPending}>
                    Delete
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
