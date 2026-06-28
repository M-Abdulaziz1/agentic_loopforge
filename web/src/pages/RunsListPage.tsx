import { Link } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { useRuns } from "../lib/api/runs";

type Props = { title: string; to: (runId: string) => string };

export function RunsListPage({ title, to }: Props) {
  const { data: runs = [], isLoading } = useRuns();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="text-base font-bold text-ink">{title}</h1>
      </div>
      <div className="flex-1 overflow-auto p-7">
        {isLoading ? (
          <div className="text-mut">Loading runs…</div>
        ) : runs.length === 0 ? (
          <div className="text-mut">No runs yet.</div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {runs.map((r) => (
              <Link key={r.id} to={to(r.id)}>
                <GlassCard className="transition hover:border-[var(--line2)]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-sm font-bold">{r.id}</span>
                    <span className="ml-auto rounded-md bg-[var(--glass2)] px-2 py-0.5 text-[11px] font-semibold text-ink2">
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-mut">
                    {r.spent_steps} steps · {r.spent_llm_calls} llm calls
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
