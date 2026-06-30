import { useState } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import {
  useCreateEvaluator,
  useDeleteEvaluator,
  useEvaluators,
  useUpdateEvaluator,
} from "../lib/api/evaluators";
import type { Evaluator, EvaluatorDirection, EvaluatorKind } from "../lib/api/types";

const KIND_BLURB: Record<EvaluatorKind, string> = {
  statistical_insight: "Significance + effect size + multiple-comparison correction.",
  ml_baseline: "Beat a baseline on held-out data + leakage check.",
  custom_metric: "A metric your code computes in the sandbox; optimize toward a target.",
  llm_rubric: "An LLM judges results against a rubric.",
};

const NEEDS_METRIC: EvaluatorKind[] = ["custom_metric", "ml_baseline"];

export function EvaluatorsPage() {
  const { data: evaluators = [], isLoading } = useEvaluators();
  const create = useCreateEvaluator();
  const [form, setForm] = useState({
    name: "",
    kind: "statistical_insight" as EvaluatorKind,
    metric_name: "",
    direction: "maximize" as EvaluatorDirection,
    target: "",
    is_default: false,
  });

  const needsMetric = NEEDS_METRIC.includes(form.kind);

  function submit() {
    if (form.name.trim().length < 1) return;
    create.mutate(
      {
        name: form.name,
        kind: form.kind,
        metric_name: needsMetric && form.metric_name ? form.metric_name : undefined,
        direction: needsMetric ? form.direction : undefined,
        target: needsMetric && form.target ? Number(form.target) : undefined,
        is_default: form.is_default,
      },
      {
        onSuccess: () =>
          setForm({
            name: "",
            kind: "statistical_insight",
            metric_name: "",
            direction: "maximize",
            target: "",
            is_default: false,
          }),
      },
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="text-base font-bold text-ink">Evaluators</h1>
        <span className="text-[12px] text-mut">
          the frozen success metric a loop optimizes toward
        </span>
      </div>

      <div className="flex-1 overflow-auto p-7">
        <div className="mx-auto grid max-w-[900px] grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-mut">
              Defined evaluators
            </div>
            {isLoading ? (
              <div className="text-mut">Loading…</div>
            ) : evaluators.length === 0 ? (
              <div className="text-mut">
                No evaluators yet — loops fall back to built-in statistical validation. Add
                one to optimize a custom metric.
              </div>
            ) : (
              <div className="space-y-3">
                {evaluators.map((ev) => (
                  <EvaluatorRow key={ev.id} evaluator={ev} />
                ))}
              </div>
            )}
          </div>

          <GlassCard className="h-fit">
            <div className="mb-3 text-xs font-bold uppercase tracking-wide text-mut">
              Add evaluator
            </div>
            <Field label="Name">
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            </Field>
            <Field label="Kind">
              <select
                aria-label="Kind"
                value={form.kind}
                onChange={(e) =>
                  setForm({ ...form, kind: e.target.value as EvaluatorKind })
                }
                className="w-full rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-2 text-[13px] text-ink"
              >
                <option className="bg-bg0" value="statistical_insight">statistical_insight</option>
                <option className="bg-bg0" value="ml_baseline">ml_baseline</option>
                <option className="bg-bg0" value="custom_metric">custom_metric</option>
                <option className="bg-bg0" value="llm_rubric">llm_rubric</option>
              </select>
              <p className="mt-1.5 text-[11px] leading-relaxed text-mut">
                {KIND_BLURB[form.kind]}
              </p>
            </Field>
            {needsMetric ? (
              <>
                <Field label="Metric name">
                  <Input
                    value={form.metric_name}
                    onChange={(v) => setForm({ ...form, metric_name: v })}
                    placeholder="roc_auc"
                  />
                </Field>
                <Field label="Direction">
                  <select
                    aria-label="Direction"
                    value={form.direction}
                    onChange={(e) =>
                      setForm({ ...form, direction: e.target.value as EvaluatorDirection })
                    }
                    className="w-full rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-2 text-[13px] text-ink"
                  >
                    <option className="bg-bg0" value="maximize">maximize</option>
                    <option className="bg-bg0" value="minimize">minimize</option>
                  </select>
                </Field>
                <Field label="Target (optional)">
                  <Input
                    value={form.target}
                    onChange={(v) => setForm({ ...form, target: v })}
                    placeholder="beat baseline if empty"
                  />
                </Field>
              </>
            ) : null}
            <label className="mb-3 flex items-center gap-2 text-[13px] text-ink2">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              />
              Set as default
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={create.isPending || !form.name}
              className="w-full rounded-xl bg-gradient-to-br from-violet to-teal px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            >
              Add evaluator
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function EvaluatorRow({ evaluator }: { evaluator: Evaluator }) {
  const update = useUpdateEvaluator(evaluator.id);
  const del = useDeleteEvaluator();

  return (
    <GlassCard>
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold">{evaluator.name}</span>
        {evaluator.is_default ? (
          <span className="rounded-md bg-[rgba(70,227,173,.14)] px-2 py-0.5 text-[11px] font-bold text-[#9af3d4]">
            default
          </span>
        ) : null}
        <span className="ml-auto rounded-md bg-[var(--glass2)] px-2 py-0.5 text-[11px] text-mut">
          {evaluator.kind}
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[12px] text-mut">
        {evaluator.metric_name
          ? `${evaluator.direction ?? ""} ${evaluator.metric_name}${
              evaluator.target != null ? ` → ${evaluator.target}` : " (beat baseline)"
            }`
          : "built-in validation"}
      </div>
      <div className="mt-3 flex gap-2">
        {!evaluator.is_default ? (
          <button
            type="button"
            onClick={() => update.mutate({ is_default: true })}
            className="rounded-lg border border-[var(--line2)] bg-[var(--glass2)] px-3 py-1.5 text-[12px] font-semibold"
          >
            Set default
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => del.mutate(evaluator.id)}
          disabled={del.isPending}
          className="ml-auto rounded-lg border border-[rgba(255,107,154,.35)] bg-[rgba(255,107,154,.12)] px-3 py-1.5 text-[12px] font-semibold text-[#ffd0e0]"
        >
          Delete
        </button>
      </div>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[10px] font-bold tracking-[.6px] text-mut">{label}</div>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[var(--line2)] bg-white/[0.03] px-3 py-2 text-[13px] text-ink outline-none focus:border-[#cdbcff]"
    />
  );
}
