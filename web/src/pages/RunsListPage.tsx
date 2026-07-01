import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { useRuns } from "../lib/api/runs";
import type { RunStatus } from "../lib/api/types";

type Props = { title: string; to: (runId: string) => string };

const STATUS: Partial<Record<RunStatus, { dot: string; text: string; bg: string }>> = {
  running: { dot: "bg-violet shadow-[0_0_8px_var(--violet)]", text: "text-[#dcd0ff]", bg: "bg-[rgba(138,108,255,.16)]" },
  completed: { dot: "bg-ok shadow-[0_0_8px_var(--ok)]", text: "text-[#9af3d4]", bg: "bg-[rgba(70,227,173,.14)]" },
  pending_approval: { dot: "bg-warn shadow-[0_0_8px_var(--warn)]", text: "text-[#ffe2a0]", bg: "bg-[rgba(255,209,102,.15)]" },
  failed: { dot: "bg-bad", text: "text-[#ffd0e0]", bg: "bg-[rgba(255,107,154,.14)]" },
  cancelled: { dot: "bg-mut", text: "text-mut", bg: "bg-[var(--glass2)]" },
  budget_exhausted: { dot: "bg-bad", text: "text-[#ffd0e0]", bg: "bg-[rgba(255,107,154,.14)]" },
};

export function RunsListPage({ title, to }: Props) {
  const { data: runs = [], isLoading } = useRuns();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-5">
        <h1 className="text-[19px] font-extrabold tracking-tight text-ink">{title}</h1>
        <span className="rounded-full bg-[var(--glass2)] px-2.5 py-0.5 font-mono text-[12px] text-ink2">
          {runs.length}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-7">
        {isLoading ? (
          <div className="text-mut">Loading runs…</div>
        ) : runs.length === 0 ? (
          <div className="grid place-items-center py-24 text-center text-mut">
            <div className="text-lg font-bold text-ink2">No runs yet</div>
            <p className="mt-1.5 max-w-sm text-sm">
              Approve a loop spec and start a run to watch the agents execute here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {runs.map((r, i) => {
              const s = STATUS[r.status] ?? { dot: "bg-mut", text: "text-ink2", bg: "bg-[var(--glass2)]" };
              return (
                <Link key={r.id} to={to(r.id)} className="lf-rise" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="group h-full rounded-2xl border border-[var(--line)] bg-[var(--glass)] p-5 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[var(--line2)] hover:shadow-[0_18px_44px_rgba(138,108,255,.16)]">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-ink">{r.id}</span>
                      <span
                        className={cn(
                          "ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[.4px]",
                          s.bg,
                          s.text,
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", s.dot)} />
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <Stat label="Steps" value={r.spent_steps} />
                    <Stat label="LLM calls" value={r.spent_llm_calls} />
                    {r.spent_usd != null ? <Stat label="Cost" value={`$${r.spent_usd.toFixed(2)}`} /> : null}

                    {r.result_summary ? (
                      <p className="mt-3 line-clamp-2 border-t border-[var(--line)] pt-3 text-[12px] leading-relaxed text-mut">
                        {r.result_summary}
                      </p>
                    ) : null}

                    <div className="mt-3 text-[12px] font-semibold text-mut transition group-hover:text-teal">
                      Open run →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1 text-[12.5px]">
      <span className="text-mut">{label}</span>
      <b className="font-mono text-ink2">{value}</b>
    </div>
  );
}
