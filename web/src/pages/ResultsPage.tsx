import { useState } from "react";
import { useParams } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { ArtifactViewer } from "../components/run/ArtifactViewer";
import { useArtifacts, useResults } from "../lib/api/results";
import type { Artifact, InsightResult, ModelResult } from "../lib/api/types";

export function ResultsPage() {
  const { runId = "" } = useParams();
  const { data: results, isLoading } = useResults(runId);
  const { data: artifacts = [] } = useArtifacts(runId);
  const [viewerId, setViewerId] = useState<string | null>(null);

  if (isLoading || !results) return <div className="p-8 text-mut">Loading results…</div>;

  const empty = results.insights.length === 0 && results.models.length === 0;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <div className="text-sm text-mut">
          Results / <b className="text-ink">{runId}</b>
        </div>
        <span className="ml-auto flex items-center gap-2 rounded-full border border-[rgba(70,227,173,.3)] bg-[rgba(70,227,173,.1)] px-3 py-1 text-[12px] font-bold text-[#9af3d4]">
          ● {results.status}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-8 py-7">
        <div className="mx-auto max-w-[960px]">
          <h1 className="text-2xl font-extrabold tracking-tight">Validated results</h1>
          <p className="mb-6 mt-1 text-sm text-mut">
            Only findings that cleared significance + effect-size thresholds (with
            multiple-comparison correction) appear here.
          </p>

          <div className="mb-7 grid grid-cols-4 gap-3.5">
            <Tile k="VALIDATED" v={String(results.summary.validated)} />
            <Tile k="REJECTED" v={String(results.summary.rejected)} />
            <Tile k="COST" v={fmtUsd(results.summary.cost_usd)} />
            <Tile k="DURATION" v={fmtDur(results.summary.duration_s)} />
          </div>

          {empty ? (
            <GlassCard className="py-12 text-center">
              <div className="text-lg font-bold">No validated findings</div>
              <p className="mx-auto mt-2 max-w-md text-sm text-mut">
                Nothing passed statistical validation for this run
                (<span className="font-mono">completed_no_findings</span>). That's an honest
                result — no fabricated insights.
              </p>
            </GlassCard>
          ) : (
            <>
              {results.insights.length ? (
                <SectionTitle>Top validated insights</SectionTitle>
              ) : null}
              {results.insights.map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}

              {results.models.length ? <SectionTitle>Models</SectionTitle> : null}
              {results.models.map((m) => (
                <ModelCard key={m.id} model={m} />
              ))}
            </>
          )}

          {artifacts.length ? (
            <>
              <SectionTitle>Artifacts</SectionTitle>
              <GlassCard>
                {artifacts.map((a) => (
                  <ArtifactRow key={a.id} artifact={a} onView={() => setViewerId(a.id)} />
                ))}
              </GlassCard>
            </>
          ) : null}
        </div>
      </div>
      {viewerId ? (
        <ArtifactViewer artifactId={viewerId} onClose={() => setViewerId(null)} />
      ) : null}
    </div>
  );
}

function InsightCard({ insight }: { insight: InsightResult }) {
  return (
    <GlassCard className="mb-3.5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-[30px] place-items-center rounded-lg bg-gradient-to-br from-violet to-teal text-sm font-extrabold">
          {insight.rank}
        </div>
        <div className="text-base font-bold">{insight.claim}</div>
        {insight.passed ? (
          <span className="ml-auto rounded-md border border-[rgba(70,227,173,.3)] bg-[rgba(70,227,173,.12)] px-2 py-0.5 text-[11px] font-bold text-[#9af3d4]">
            ✓ PASSED
          </span>
        ) : null}
      </div>
      <div className="mb-3 flex flex-wrap gap-2.5">
        <Stat label="test" value={insight.test} />
        <Stat label="p" value={insight.p_value.toString()} />
        <Stat label={insight.effect_name} value={insight.effect_value.toString()} />
        <Stat label="n" value={insight.n.toLocaleString()} />
        {insight.correction ? <Stat label="corrected" value={insight.correction} /> : null}
      </div>
      <div className="flex gap-2">
        <Drill>▤ test code</Drill>
        <Drill>◷ trace</Drill>
        <Drill>⌬ context used</Drill>
        {insight.plot_ref ? <Drill>▦ {insight.plot_ref}</Drill> : null}
      </div>
    </GlassCard>
  );
}

function ModelCard({ model }: { model: ModelResult }) {
  return (
    <GlassCard className="mb-3.5">
      <div className="mb-2 flex items-center gap-3">
        <div className="text-base font-bold">{model.name}</div>
        <span
          className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold ${
            model.beats_baseline
              ? "border border-[rgba(70,227,173,.3)] bg-[rgba(70,227,173,.12)] text-[#9af3d4]"
              : "border border-[rgba(255,107,154,.3)] bg-[rgba(255,107,154,.12)] text-[#ffb9d2]"
          }`}
        >
          {model.beats_baseline ? "✓ beats baseline" : "✕ below baseline"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Stat label={model.metric_name} value={model.metric_value.toString()} />
        <Stat label={`baseline (${model.baseline_name})`} value={model.baseline_value.toString()} />
        <Stat label="leakage" value={model.leakage_ok ? "clean" : "FAILED"} />
      </div>
    </GlassCard>
  );
}

function ArtifactRow({ artifact, onView }: { artifact: Artifact; onView: () => void }) {
  const filename =
    typeof artifact.metadata.filename === "string" ? artifact.metadata.filename : artifact.id;
  return (
    <div className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-0">
      <span className="rounded-md bg-[var(--glass2)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.4px] text-ink2">
        {artifact.kind}
      </span>
      <span className="font-mono text-[13px]">{filename}</span>
      <button
        type="button"
        onClick={onView}
        className="ml-auto rounded-lg border border-[rgba(74,214,255,.25)] bg-[rgba(74,214,255,.1)] px-3 py-1.5 text-[12px] font-semibold text-teal"
      >
        View / extract
      </button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 mt-1 text-xs font-bold uppercase tracking-wide text-mut">
      {children}
    </div>
  );
}
function Tile({ k, v }: { k: string; v: string }) {
  return (
    <GlassCard className="p-4">
      <div className="text-[11px] tracking-[.4px] text-mut">{k}</div>
      <div className="mt-1 text-2xl font-extrabold">{v}</div>
    </GlassCard>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg border border-[var(--line)] bg-[var(--glass2)] px-2.5 py-1.5 text-[12px] text-ink2">
      {label} <b className="text-white">{value}</b>
    </span>
  );
}
function Drill({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-[rgba(74,214,255,.25)] bg-[rgba(74,214,255,.1)] px-2.5 py-1.5 text-[12px] font-semibold text-teal"
    >
      {children}
    </button>
  );
}
function fmtUsd(v: number | null) {
  return v === null ? "—" : `$${v.toFixed(2)}`;
}
function fmtDur(s: number | null) {
  if (s === null) return "—";
  const m = Math.floor(s / 60);
  return m ? `${m}m${String(Math.round(s % 60)).padStart(2, "0")}s` : `${s}s`;
}
