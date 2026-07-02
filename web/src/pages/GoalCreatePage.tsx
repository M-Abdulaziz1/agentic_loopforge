import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { Toggle } from "../components/ui/Toggle";
import { AutonomySlider } from "../components/ui/AutonomySlider";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Field";
import { cn } from "../lib/cn";
import { lockTogglesForMode } from "../lib/capabilities";
import { DEFAULT_AUTONOMY } from "../lib/autonomy";
import { ApiError } from "../lib/api/client";
import { useCreateGoal } from "../lib/api/goals";
import { useLlmProviders } from "../lib/api/llmProviders";
import { datasetUploadErrorMessage, useDatasets, useUploadDataset } from "../lib/api/datasets";
import { useEvaluators } from "../lib/api/evaluators";
import type { AutonomyLevel, Budget, Dataset, GoalMode, GoalToggles } from "../lib/api/types";

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
  const uploadDataset = useUploadDataset();
  const { data: evaluators = [] } = useEvaluators();
  const [providerId, setProviderId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState("");
  const [uploadedDataset, setUploadedDataset] = useState<Dataset | null>(null);
  const datasetFileRef = useRef<HTMLInputElement>(null);
  const [evaluatorId, setEvaluatorId] = useState("");
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(DEFAULT_AUTONOMY);
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
  const selectableDatasets =
    uploadedDataset && !datasets.some((dataset) => dataset.id === uploadedDataset.id)
      ? [uploadedDataset, ...datasets]
      : datasets;

  async function uploadAndUseDataset() {
    if (!datasetFile) return;
    const uploaded = await uploadDataset.mutateAsync({
      file: datasetFile,
      name: datasetName || undefined,
    });
    setUploadedDataset(uploaded);
    setDatasetId(uploaded.id);
    setDatasetFile(null);
    setDatasetName("");
    if (datasetFileRef.current) datasetFileRef.current.value = "";
  }

  async function submit() {
    try {
      const res = await createGoal.mutateAsync({
        text,
        mode,
        toggles: effectiveToggles,
        constraints: {},
        budget,
        llm_provider_id: providerId || null,
        dataset_id: datasetId || null,
        evaluator_id: evaluatorId || null,
        autonomy,
      });
      if (res.loop_spec) navigate(`/specs/${res.loop_spec.id}`);
      else if (res.clarification) navigate(`/goals/${res.goal.id}/clarify`);
      else navigate(`/goals/${res.goal.id}`);
    } catch {
      // Error surfaced below via createGoal.isError — no fake fallback.
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-7 py-4 text-sm text-mut">
        Goals / <b className="text-ink">New goal</b>
      </div>
      <div className="flex flex-1 justify-center overflow-auto px-7 pb-28 pt-8">
        <div className="w-full max-w-[760px]">
          <h1 className="font-display text-[32px] leading-none">Define a new goal</h1>
          <p className="mb-6 mt-1.5 text-sm text-mut">
            Describe the end result you want. LoopForge checks if it's clear enough to build a
            loop — and asks focused questions if not.
          </p>

          <GlassCard className="mb-[18px]">
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              Your goal
            </div>
            <Textarea
              aria-label="Goal"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Find the main drivers of customer churn in the Q2 dataset and validate them statistically."
              className="min-h-[120px] text-[15px]"
            />
          </GlassCard>

          <GlassCard className="mb-[18px]">
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
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
                      ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_10%,var(--surface))]"
                      : "border-[var(--line2)] hover:border-[var(--violet)]",
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
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              Autonomy
            </div>
            <p className="mb-4 text-[12.5px] text-mut">
              How short a leash to keep the loop on — sets the human approval gates. Budget,
              sandbox, and read-only data always apply regardless.
            </p>
            <AutonomySlider value={autonomy} onChange={setAutonomy} />
          </GlassCard>

          <GlassCard className="mb-[18px]">
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
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
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
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
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              Dataset
            </div>
            <Select
              aria-label="Dataset"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
            >
              <option value="" className="bg-surface text-ink">
                None (DB only)
              </option>
              {selectableDatasets.map((d) => (
                <option key={d.id} value={d.id} className="bg-surface text-ink">
                  {d.name} · {d.kind}
                </option>
              ))}
            </Select>
            {datasetId ? (
              <div className="mt-2 text-[12.5px] text-mut">
                Using {selectableDatasets.find((d) => d.id === datasetId)?.name ?? "uploaded dataset"}.
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4 sm:grid-cols-[1fr_170px]">
              <div>
                <input
                  ref={datasetFileRef}
                  type="file"
                  aria-label="Upload dataset file"
                  accept=".csv,.parquet"
                  onChange={(e) => setDatasetFile(e.target.files?.[0] ?? null)}
                  className="w-full text-[12px] text-ink2 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--glass2)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-ink"
                />
                <Input
                  type="text"
                  aria-label="Dataset display name"
                  value={datasetName}
                  placeholder={datasetFile?.name ?? "Display name (optional)"}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="mt-2 h-10 text-[13px]"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={uploadAndUseDataset}
                disabled={!datasetFile}
                loading={uploadDataset.isPending}
              >
                {uploadDataset.isPending ? "Uploading…" : "Upload & use"}
              </Button>
            </div>
            {uploadDataset.isError ? (
              <div className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--bad)_11%,var(--surface))] px-3 py-1.5 text-[12px] text-bad">
                {datasetUploadErrorMessage(uploadDataset.error)}
              </div>
            ) : null}
          </GlassCard>

          <GlassCard className="mt-[18px]">
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              Success metric (evaluator)
            </div>
            {evaluators.length === 0 ? (
              <p className="text-[13px] text-mut">
                No evaluators defined — the loop uses built-in statistical validation. Add one
                under <b>Evaluators</b> to optimize a custom metric.
              </p>
            ) : (
              <Select
                aria-label="Evaluator"
                value={evaluatorId}
                onChange={(e) => setEvaluatorId(e.target.value)}
              >
                <option value="" className="bg-surface text-ink">
                  Default evaluator
                </option>
                {evaluators.map((ev) => (
                  <option key={ev.id} value={ev.id} className="bg-surface text-ink">
                    {ev.name} · {ev.kind}
                  </option>
                ))}
              </Select>
            )}
          </GlassCard>

          <GlassCard className="mt-[18px]">
            <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              LLM provider
            </div>
            {providers.length === 0 ? (
              <p className="text-[13px] text-mut">
                No providers configured — runs use the env default. Add one in <b>Settings</b>.
              </p>
            ) : (
              <Select
                aria-label="LLM provider"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
              >
                <option value="" className="bg-surface text-ink">
                  Default provider
                </option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-surface text-ink">
                    {p.name} · {p.model}
                  </option>
                ))}
              </Select>
            )}
          </GlassCard>
        </div>
      </div>

      <div className="fixed bottom-0 left-[250px] right-0 flex items-center gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg0)_92%,transparent)] px-7 py-4 backdrop-blur-md">
        {createGoal.isError ? (
          <div className="max-w-[60%] rounded-lg bg-[color-mix(in_srgb,var(--bad)_12%,var(--surface))] px-3 py-1.5 text-[12.5px] text-bad">
            {goalCreateErrorMessage(createGoal.error)}
          </div>
        ) : (
          <div className="text-[12.5px] text-mut">
            Next: clarity check → clarification (if needed) → generated loop spec.
          </div>
        )}
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => navigate("/goals")}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={text.trim().length < 3 || uploadDataset.isPending}
          loading={createGoal.isPending}
        >
          {createGoal.isPending ? "Checking…" : "Create & check clarity →"}
        </Button>
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
        className="mt-1.5 w-full bg-transparent font-display text-[30px] text-ink outline-none"
      />
    </div>
  );
}

function goalCreateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const detail =
      typeof error.body === "object" && error.body !== null && "detail" in error.body
        ? String((error.body as { detail?: unknown }).detail)
        : "";
    if (error.status === 502)
      return detail || "The LLM provider failed to produce a valid result. Check your provider in Settings.";
    if (error.status === 404)
      return detail || "Selected provider, dataset, or evaluator was not found.";
    if (error.status === 422) return detail || "The LLM provider request failed.";
    return detail || `Goal creation failed (API ${error.status}).`;
  }
  return "Goal creation failed. Check your LLM provider and try again.";
}
