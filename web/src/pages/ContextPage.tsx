import { useParams } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { cn } from "../lib/cn";
import { useRunContext } from "../lib/api/results";
import { useRun } from "../lib/api/runs";
import { useGoal } from "../lib/api/goals";
import type { ContextEntry } from "../lib/api/types";

const KIND_STYLE: Record<string, string> = {
  goal: "bg-[color-mix(in_srgb,var(--violet)_13%,var(--surface))] text-violet",
  summary: "bg-[color-mix(in_srgb,var(--warn)_16%,var(--surface))] text-warn",
  tool: "bg-[var(--glass2)] text-ink2",
  llm: "bg-[color-mix(in_srgb,var(--violet)_12%,var(--surface))] text-violet",
  artifact: "bg-[color-mix(in_srgb,var(--ok)_13%,var(--surface))] text-ok",
};

export function ContextPage() {
  const { runId = "" } = useParams();
  const { data: ctx, isLoading } = useRunContext(runId);
  const { data: run } = useRun(runId);
  const { data: goal } = useGoal(run?.goal_id ?? "");

  if (isLoading || !ctx) return <div className="p-8 text-mut">Loading context…</div>;

  const budget = goal?.budget.max_context_tokens;
  const packPct = budget ? Math.min(1, ctx.pack.token_count / budget) * 100 : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4 text-sm text-mut">
        Context &amp; Memory / <b className="text-ink">{runId}</b>
        <span className="ml-auto text-[12.5px]">
          ledger: {ctx.ledger.length} entries
        </span>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        {/* ledger timeline */}
        <div className="overflow-auto border-r border-[var(--line)] p-6">
          <div className="mb-3.5 text-xs font-bold uppercase tracking-wide text-mut">
            Context ledger
            <span className="ml-2 font-normal normal-case tracking-normal">
              — append-only, preserved for replay
            </span>
          </div>
          <div className="relative pl-6">
            <div className="absolute bottom-1 left-[7px] top-1 w-0.5 bg-violet opacity-40" />
            {ctx.ledger.map((e) => (
              <LedgerEntry key={e.id} entry={e} />
            ))}
          </div>
        </div>

        {/* right rail */}
        <div className="overflow-auto p-5">
          <GlassCard className="mb-4 p-[18px]">
            <h3 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              Current context pack
            </h3>
            <div className="mb-2 h-3 overflow-hidden rounded-md bg-[var(--glass2)]">
              <div
                className="h-full bg-violet"
                style={{ width: `${packPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[12px] text-mut">
              <span>
                used <b className="text-ink">{fmtTok(ctx.pack.token_count)}</b>
              </span>
              <span>
                budget <b className="text-ink">{fmtTok(budget)}</b>
              </span>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink2">{ctx.pack.summary}</p>
          </GlassCard>

          <GlassCard className="mb-4 p-[18px]">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">
              Compaction
            </h3>
            <p className="text-[13px] leading-relaxed text-ink2">
              Older history is compacted into durable summaries — working memory shrinks,{" "}
              <b>the audit log is untouched</b>.
            </p>
          </GlassCard>

          <div
            className={cn(
              "flex gap-2.5 rounded-2xl border p-3.5 text-[12.5px] leading-relaxed",
              ctx.pack.overflow
                ? "border-[color-mix(in_srgb,var(--bad)_42%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_10%,var(--surface))] text-bad"
                : "border-[color-mix(in_srgb,var(--warn)_28%,var(--line))] bg-[color-mix(in_srgb,var(--warn)_9%,var(--surface))] text-ink2",
            )}
          >
            <span className="text-warn">⚠</span>
            <span>
              {ctx.pack.overflow
                ? "Context overflow — the run paused; a safe pack could not be built within budget."
                : "If a safe pack can't be built within budget, the run pauses with context_overflow — it never silently drops a requirement."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerEntry({ entry }: { entry: ContextEntry }) {
  const isSummary = entry.kind === "summary";
  return (
    <div className="relative mb-3.5">
      <div
        className={cn(
          "absolute -left-[21px] top-1.5 size-[11px] rounded-full border-2 bg-bg0",
          isSummary ? "border-warn bg-warn" : "border-teal",
        )}
      />
      <GlassCard className="p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-[.4px]",
              KIND_STYLE[entry.kind] ?? "bg-[var(--glass2)] text-ink2",
            )}
          >
            {entry.kind.toUpperCase()}
          </span>
          <span className="ml-auto text-[11px] text-mut">{entry.token_count} tok</span>
        </div>
        <div className="text-[13px] leading-relaxed text-ink2">{entry.text}</div>
        {entry.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="rounded border border-[var(--line)] bg-[var(--glass2)] px-1.5 py-0.5 text-[10px] text-mut"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
}

function fmtTok(n?: number) {
  if (n === undefined) return "–";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
