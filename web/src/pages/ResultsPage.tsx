import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { ArtifactViewer } from "../components/run/ArtifactViewer";
import { useArtifacts, useResults } from "../lib/api/results";
import { useRunFile, useRunFiles } from "../lib/api/runs";
import type { Artifact, InsightResult, ModelResult } from "../lib/api/types";

export function ResultsPage() {
  const { runId = "" } = useParams();
  const { data: results, isLoading } = useResults(runId);
  const { data: artifacts = [] } = useArtifacts(runId);
  const { data: files = [] } = useRunFiles(runId);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [zoomPath, setZoomPath] = useState<string | null>(null);

  if (isLoading || !results) return <div className="p-8 text-mut">Loading results…</div>;

  const empty = results.insights.length === 0 && results.models.length === 0;
  const plots = files.filter((f) => f.category === "plot");
  const outputs = files.filter((f) => f.category === "output");
  const code = files.filter((f) => f.category === "code");
  // The Report section is for written reports only — models are shown in the model
  // card above, code/plots in their own sections. Agent turns re-emit the same
  // report.md filename with different bodies, so dedupe on content, not filename.
  const uniqueArtifacts = Array.from(
    new Map(
      artifacts
        .filter((a) => a.kind === "report")
        .map((a) => [String(a.metadata.content ?? a.id), a]),
    ).values(),
  );

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

          {plots.length ? (
            <>
              <SectionTitle>Visualizations</SectionTitle>
              <div className="mb-2 grid grid-cols-2 gap-3.5">
                {plots.map((p) => (
                  <PlotCard
                    key={p.path}
                    runId={runId}
                    path={p.path}
                    onZoom={() => setZoomPath(p.path)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {outputs.length || code.length ? (
            <>
              <SectionTitle>Outputs &amp; generated code</SectionTitle>
              <GlassCard>
                <div className="flex flex-wrap gap-2">
                  {[...code, ...outputs].map((f) => (
                    <Link
                      key={f.path}
                      to={`/runs/${runId}?tab=files`}
                      className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--glass2)] px-2.5 py-1.5 text-[12.5px] text-ink2 transition hover:border-[var(--accent)]"
                    >
                      <span className="text-[var(--accent)]">{f.category === "code" ? "❯" : "◆"}</span>
                      <span className="font-mono">{f.path.split("/").pop()}</span>
                      <span className="text-[10.5px] text-mut">{fmtBytes(f.size)}</span>
                    </Link>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-mut">
                  Full contents are browsable in the run's{" "}
                  <Link to={`/runs/${runId}?tab=files`} className="text-[var(--accent)]">
                    Files tab
                  </Link>
                  .
                </p>
              </GlassCard>
            </>
          ) : null}

          {uniqueArtifacts.length ? (
            <>
              <SectionTitle>Report</SectionTitle>
              <GlassCard>
                {uniqueArtifacts.map((a) => (
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
      {zoomPath ? (
        <Lightbox runId={runId} path={zoomPath} onClose={() => setZoomPath(null)} />
      ) : null}
    </div>
  );
}

function Lightbox({ runId, path, onClose }: { runId: string; path: string; onClose: () => void }) {
  const { data: file } = useRunFile(runId, path);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-8 backdrop-blur-sm"
    >
      <div className="font-mono text-[12px] text-white/70">{path.split("/").pop()}</div>
      {file?.data_uri ? (
        <img
          src={file.data_uri}
          alt={path}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[85vh] max-w-[90vw] rounded-lg border border-white/10 bg-white shadow-2xl"
        />
      ) : (
        <div className="text-sm text-white/60">Loading…</div>
      )}
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-white/20 px-3 py-1.5 text-[12px] font-semibold text-white/80 transition hover:bg-white/10"
      >
        Close (Esc)
      </button>
    </div>
  );
}

function InsightCard({ insight }: { insight: InsightResult }) {
  return (
    <GlassCard className="mb-3.5">
      <div className="mb-3 flex items-center gap-3">
        <div className="grid size-[30px] place-items-center rounded-lg bg-[var(--accent)] text-sm font-extrabold">
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
  const passed = model.beats_baseline && model.leakage_ok;
  const lift = model.metric_value - model.baseline_value;
  return (
    <GlassCard className="mb-3.5 overflow-hidden p-0">
      {/* model-card header: name + overall verdict */}
      <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--glass2)] px-5 py-3.5">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.4px] text-mut">Model card</div>
          <div className="text-base font-bold">{model.name}</div>
        </div>
        <span className={`ml-auto ${passed ? passBadge : failBadge}`}>
          {passed ? "✓ Validated" : "✕ Rejected"}
        </span>
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-[auto_1fr]">
        {/* headline metric */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--glass2)] px-5 py-3 text-center md:min-w-[150px]">
          <div className="text-[11px] uppercase tracking-[.4px] text-mut">{model.metric_name}</div>
          <div className="mt-1 text-3xl font-extrabold tabular-nums">{fmtNum(model.metric_value)}</div>
        </div>

        {/* metrics vs thresholds, each with pass/fail */}
        <div className="flex flex-col divide-y divide-[var(--line)]">
          <ThresholdRow
            label={`Beats baseline (${model.baseline_name})`}
            detail={`${fmtNum(model.metric_value)} vs ${fmtNum(model.baseline_value)} · +${fmtNum(lift)}`}
            ok={model.beats_baseline}
          />
          <ThresholdRow
            label="Leakage check"
            detail={model.leakage_ok ? "no train/test leakage detected" : "leakage detected"}
            ok={model.leakage_ok}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function ThresholdRow({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className={ok ? "text-[#46e3ad]" : "text-[#ff6b9a]"}>{ok ? "✓" : "✕"}</span>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <span className="ml-auto font-mono text-[12px] text-mut">{detail}</span>
      <span className={ok ? passPill : failPill}>{ok ? "PASS" : "FAIL"}</span>
    </div>
  );
}

const passBadge =
  "rounded-md border border-[rgba(70,227,173,.3)] bg-[rgba(70,227,173,.12)] px-2.5 py-1 text-[11px] font-bold text-[#9af3d4]";
const failBadge =
  "rounded-md border border-[rgba(255,107,154,.3)] bg-[rgba(255,107,154,.12)] px-2.5 py-1 text-[11px] font-bold text-[#ffb9d2]";
const passPill =
  "rounded border border-[rgba(70,227,173,.3)] bg-[rgba(70,227,173,.12)] px-1.5 py-0.5 text-[10px] font-bold text-[#9af3d4]";
const failPill =
  "rounded border border-[rgba(255,107,154,.3)] bg-[rgba(255,107,154,.12)] px-1.5 py-0.5 text-[10px] font-bold text-[#ffb9d2]";

function fmtNum(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
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
        className="ml-auto rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-semibold text-teal"
      >
        View / extract
      </button>
    </div>
  );
}

function PlotCard({ runId, path, onZoom }: { runId: string; path: string; onZoom: () => void }) {
  const { data: file } = useRunFile(runId, path);
  return (
    <GlassCard className="p-3">
      <div className="mb-2 font-mono text-[11.5px] text-mut">{path.split("/").pop()}</div>
      {file?.data_uri ? (
        <button
          type="button"
          onClick={onZoom}
          className="group block w-full overflow-hidden rounded-lg border border-[var(--line)]"
          title="Click to view full size"
        >
          <img
            src={file.data_uri}
            alt={path}
            className="w-full bg-white transition group-hover:opacity-90"
          />
        </button>
      ) : (
        <div className="grid h-40 place-items-center rounded-lg bg-[var(--glass2)] text-xs text-mut">
          Loading plot…
        </div>
      )}
    </GlassCard>
  );
}

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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
      className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-1.5 text-[12px] font-semibold text-teal"
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
