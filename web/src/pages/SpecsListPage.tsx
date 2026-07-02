import { Link } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { Badge } from "../components/ui/Badge";
import { useLoopSpecs } from "../lib/api/loopspecs";

type BadgeTone = "neutral" | "brand" | "ok" | "warn" | "bad";
const STATUS_TONE: Record<string, BadgeTone> = {
  draft: "warn",
  approved: "ok",
  rejected: "bad",
};

export function SpecsListPage() {
  const { data: specs = [], isLoading } = useLoopSpecs();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="font-display text-[28px] leading-none text-ink">Loop Specs</h1>
      </div>
      <div className="flex-1 overflow-auto p-7">
        {isLoading ? (
          <div className="text-mut">Loading specs…</div>
        ) : specs.length === 0 ? (
          <div className="text-mut">
            No loop specs yet. Create a goal — once it's clear, a spec is generated for review.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {specs.map((s) => (
              <Link key={s.id} to={`/specs/${s.id}`} className="group">
                <GlassCard className="h-full transition group-hover:-translate-y-0.5 group-hover:border-[var(--line2)]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-[12px] text-mut">{s.id}</span>
                    <Badge className="ml-auto" tone={STATUS_TONE[s.status] ?? "neutral"}>
                      {s.status}
                    </Badge>
                  </div>
                  <div className="text-[13px] text-ink2">
                    v{s.version} · {s.agents.length} agents · {s.gates.length} gates
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.agents.map((a) => (
                      <span
                        key={a.name}
                        className="rounded-md border border-[var(--line)] bg-[var(--glass2)] px-2 py-0.5 text-[11px] text-ink2"
                      >
                        {a.name}
                      </span>
                    ))}
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
