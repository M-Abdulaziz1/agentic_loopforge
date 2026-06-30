import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { Toggle } from "../components/ui/Toggle";
import { cn } from "../lib/cn";
import { lockTogglesForMode } from "../lib/capabilities";
import { useCreateGoal } from "../lib/api/goals";
import { useLlmProviders } from "../lib/api/llmProviders";
import { useDatasets } from "../lib/api/datasets";
import type { Budget, GoalMode, GoalToggles } from "../lib/api/types";

const MODES: { value: GoalMode; icon: string; title: string; blurb: string }[] = [
  {
    value: "offline_local",
    icon: "◐",
    title: "Offline-Local",
    blurb:
      "Runs entirely on local infra. Local LLM, sandboxed code, local connectors. No internet tools for agents.",
  },
  {
    value: "online_enabled",
    icon: "◍",
    title: "Online-Enabled",
    blurb:
      "Same foundation, but approved browser / search / API tools are allowed. Internet usage is audited per run.",
  },
];

export function GoalCreatePage() {
  const navigate = useNavigate();
  const createGoal = useCreateGoal();
  const { data: providers = [] } = useLlmProviders();
  const { data: datasets = [] } = useDatasets();
  const [providerId, setProviderId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [text, setText] = useState("");
  const [mode, setMode] = useState<GoalMode>("offline_local");
  const [toggles, setToggles] = useState<GoalToggles>({
    internet: false,
    code_sandbox: true,
    local_connectors: true,
  });
  const [budget, setBudget] = useState<Budget>({
    max_steps: 12,
    max_llm_calls: 20,
    max_context_tokens: 8000,
  });

  const internetLocked = mode === "offline_local";
  const effectiveToggles = lockTogglesForMode(toggles, mode);

  async function submit() {
    const res = await createGoal.mutateAsync({
      text,
      mode,
      toggles: effectiveToggles,
      constraints: {},
      budget,
      llm_provider_id: providerId || null,
      dataset_id: datasetId || null,
    });
    if (res.loop_spec) navigate(`/specs/${res.loop_spec.id}`);
    else if (res.clarification) navigate(`/goals/${res.goal.id}/clarify`);
    else navigate(`/goals/${res.goal.id}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-7 py-4 text-sm text-mut">
        Goals / <b className="text-ink">New goal</b>
      </div>
      <div className="flex flex-1 justify-center overflow-auto px-7 pb-28 pt-8">
        <div className="w-full max-w-[760px]">
          <h1 className="text-[26px] font-extrabold tracking-tight">Define a new goal</h1>
          <p className="mb-6 mt-1.5 text-sm text-mut">
            Describe the end result you want. LoopForge checks if it's clear enough to build a
            loop — and asks focused questions if not.
          </p>

          <GlassCard className="mb-[18px]">
            <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">
              Your goal
            </div>
            <textarea
              aria-label="Goal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Find the main drivers of customer churn in the Q2 dataset and validate them statistically."
              className="min-h-[120px] w-full resize-y rounded-xl border border-[var(--line2)] bg-white/[0.03] p-4 text-[15px] leading-relaxed text-ink outline-none focus:border-[#cdbcff]"
            />
          </GlassCard>

          <GlassCard className="mb-[18px]">
            <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">
              Runtime mode
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    mode === m.value
                      ? "border-[#cdbcff] bg-gradient-to-br from-[rgba(138,108,255,.2)] to-[rgba(74,214,255,.1)]"
                      : "border-[var(--line2)] hover:border-[rgba(205,188,255,.5)]",
                  )}
                >
                  <div className="flex items-center gap-2.5 font-bold">
                    <span className="grid size-[30px] place-items-center rounded-lg bg-[var(--glass2)]">
                      {m.icon}
                    </span>
                    {m.title}
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-mut">{m.blurb}</p>
                </button>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="mb-[18px]">
            <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">
              Capabilities
            </div>
            <CapRow
              title="Code sandbox"
              desc="Run generated code in Docker + gVisor (non-root, no host access)."
              checked={effectiveToggles.code_sandbox}
              onChange={(v) => setToggles((t) => ({ ...t, code_sandbox: v }))}
            />
            <CapRow
              title="Local connectors"
              desc="Access user-configured local data sources & workspace files."
              checked={effectiveToggles.local_connectors}
              onChange={(v) => setToggles((t) => ({ ...t, local_connectors: v }))}
            />
            <CapRow
              title="Internet access"
              desc={
                internetLocked
                  ? "Disabled in Offline-Local mode."
                  : "Allow approved browser / search / API tools."
              }
              checked={effectiveToggles.internet}
              disabled={internetLocked}
              onChange={(v) => setToggles((t) => ({ ...t, internet: v }))}
              last
            />
          </GlassCard>

          <GlassCard>
            <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">
              Budget caps{" "}
              <span className="font-normal normal-case tracking-normal">
                — hard kill switch; the loop stops when any cap is hit
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <BudgetField
                label="MAX STEPS"
                value={budget.max_steps}
                onChange={(v) => setBudget((b) => ({ ...b, max_steps: v }))}
              />
              <BudgetField
                label="MAX LLM CALLS"
                value={budget.max_llm_calls}
                onChange={(v) => setBudget((b) => ({ ...b, max_llm_calls: v }))}
              />
              <BudgetField
                label="MAX CONTEXT TOK"
                value={budget.max_context_tokens}
                step={512}
                onChange={(v) => setBudget((b) => ({ ...b, max_context_tokens: v }))}
              />
            </div>
          </GlassCard>

          <GlassCard className="mt-[18px]">
            <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">
              Dataset
            </div>
            {datasets.length === 0 ? (
              <p className="text-[13px] text-mut">
                No datasets uploaded — the loop runs against the read-only DB only. Add one
                under <b>Datasets</b>.
              </p>
            ) : (
              <select
                aria-label="Dataset"
                value={datasetId}
                onChange={(e) => setDatasetId(e.target.value)}
                className="w-full rounded-xl border border-[var(--line2)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-[#cdbcff]"
              >
                <option value="" className="bg-bg0">
                  None (DB only)
                </option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id} className="bg-bg0">
                    {d.name} · {d.kind}
                  </option>
                ))}
              </select>
            )}
          </GlassCard>

          <GlassCard className="mt-[18px]">
            <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">
              LLM provider
            </div>
            {providers.length === 0 ? (
              <p className="text-[13px] text-mut">
                No providers configured — runs use the env default. Add one in <b>Settings</b>.
              </p>
            ) : (
              <select
                aria-label="LLM provider"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="w-full rounded-xl border border-[var(--line2)] bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-[#cdbcff]"
              >
                <option value="" className="bg-bg0">
                  Default provider
                </option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-bg0">
                    {p.name} · {p.model}
                  </option>
                ))}
              </select>
            )}
          </GlassCard>
        </div>
      </div>

      <div className="fixed bottom-0 left-[250px] right-0 flex items-center gap-3 border-t border-[var(--line)] bg-[rgba(8,8,26,.92)] px-7 py-4 backdrop-blur">
        <div className="text-[12.5px] text-mut">
          Next: clarity check → clarification (if needed) → generated loop spec.
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => navigate("/goals")}
          className="rounded-xl border border-[var(--line2)] bg-[var(--glass2)] px-[18px] py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={text.trim().length < 3 || createGoal.isPending}
          className="rounded-xl bg-gradient-to-br from-violet to-teal px-[22px] py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(138,108,255,.35)] disabled:opacity-50"
        >
          {createGoal.isPending ? "Checking…" : "Create & check clarity →"}
        </button>
      </div>
    </div>
  );
}

function CapRow(props: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 py-3.5",
        !props.last && "border-b border-[var(--line)]",
      )}
    >
      <div className="flex-1">
        <b className="text-sm">{props.title}</b>
        <p className="mt-0.5 text-[12.5px] text-mut">{props.desc}</p>
      </div>
      <Toggle
        checked={props.checked}
        onChange={props.onChange}
        disabled={props.disabled}
        label={props.title}
      />
    </div>
  );
}

function BudgetField(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <div className="rounded-xl border border-[var(--line2)] p-3.5">
      <div className="text-[11px] tracking-wide text-mut">{props.label}</div>
      <input
        type="number"
        aria-label={props.label}
        value={props.value}
        step={props.step ?? 1}
        min={0}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-1.5 w-full bg-transparent text-2xl font-extrabold text-ink outline-none"
      />
    </div>
  );
}
