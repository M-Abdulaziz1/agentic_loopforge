import { useState } from "react";
import { GlassCard } from "../components/ui/GlassCard";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Field";
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
        <h1 className="font-display text-[28px] leading-none text-ink">Evaluators</h1>
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
              <Select
                aria-label="Kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as EvaluatorKind })}
              >
                <option className="bg-surface text-ink" value="statistical_insight">statistical_insight</option>
                <option className="bg-surface text-ink" value="ml_baseline">ml_baseline</option>
                <option className="bg-surface text-ink" value="custom_metric">custom_metric</option>
                <option className="bg-surface text-ink" value="llm_rubric">llm_rubric</option>
              </Select>
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
                  <Select
                    aria-label="Direction"
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value as EvaluatorDirection })}
                  >
                    <option className="bg-surface text-ink" value="maximize">maximize</option>
                    <option className="bg-surface text-ink" value="minimize">minimize</option>
                  </Select>
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
                className="size-4 accent-[var(--violet)]"
              />
              Set as default
            </label>
            <Button className="w-full" onClick={submit} disabled={!form.name} loading={create.isPending}>
              Add evaluator
            </Button>
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
          <span className="rounded-md bg-[color-mix(in_srgb,var(--ok)_12%,var(--surface))] px-2 py-0.5 text-[11px] font-bold text-ok">
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
          <Button variant="secondary" size="sm" onClick={() => update.mutate({ is_default: true })}>
            Set default
          </Button>
        ) : null}
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={() => del.mutate(evaluator.id)}
          loading={del.isPending}
        >
          Delete
        </Button>
      </div>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">{label}</div>
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
      className="h-11 w-full rounded-lg border border-[var(--line2)] bg-[var(--surface)] px-3.5 text-[14px] text-ink placeholder:text-[var(--mut-soft)] outline-none transition focus:border-[var(--violet)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--violet)_22%,transparent)]"
    />
  );
}
