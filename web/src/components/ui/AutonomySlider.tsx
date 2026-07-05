import { cn } from "../../lib/cn";
import {
  AUTONOMY_LEVELS,
  AUTONOMY_META,
  gatesForAutonomy,
} from "../../lib/autonomy";
import type { AutonomyLevel } from "../../lib/api/types";

export function AutonomySlider({
  value,
  onChange,
}: {
  value: AutonomyLevel;
  onChange: (v: AutonomyLevel) => void;
}) {
  const index = AUTONOMY_LEVELS.indexOf(value);
  const meta = AUTONOMY_META[value];
  const gates = gatesForAutonomy(value);
  const pct = (index / (AUTONOMY_LEVELS.length - 1)) * 100;

  return (
    <div>
      <div
        role="slider"
        aria-label="Autonomy"
        aria-valuemin={0}
        aria-valuemax={AUTONOMY_LEVELS.length - 1}
        aria-valuenow={index}
        aria-valuetext={meta.label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" && index > 0)
            onChange(AUTONOMY_LEVELS[index - 1]);
          if (e.key === "ArrowRight" && index < AUTONOMY_LEVELS.length - 1)
            onChange(AUTONOMY_LEVELS[index + 1]);
        }}
        className="relative mt-1 h-2 rounded-full bg-[var(--glass2)] outline-none"
      >
        <div
          className="absolute left-0 top-0 h-2 rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${pct}%` }}
        />
        {AUTONOMY_LEVELS.map((level, i) => {
          const left = (i / (AUTONOMY_LEVELS.length - 1)) * 100;
          const active = i <= index;
          return (
            <button
              key={level}
              type="button"
              aria-label={AUTONOMY_META[level].label}
              aria-pressed={level === value}
              onClick={() => onChange(level)}
              style={{ left: `${left}%` }}
              className={cn(
                "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition",
                active
                  ? "border-white bg-[var(--accent)]"
                  : "border-[var(--line2)] bg-bg0",
              )}
            />
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-mut">
        {AUTONOMY_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              "transition",
              level === value ? "text-ink" : "hover:text-ink2",
            )}
          >
            {AUTONOMY_META[level].label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-white/[0.02] p-3">
        <span className="rounded-md bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent)]">
          {meta.leash}
        </span>
        <span className="text-[12.5px] text-mut">{meta.blurb}</span>
      </div>

      <div className="mt-2.5 text-[12px] text-mut">
        Human gates:{" "}
        {gates.length === 0 ? (
          <span className="text-ink2">none — runs to the budget cap</span>
        ) : (
          gates.map((g) => (
            <span
              key={g}
              className="mr-1.5 inline-block rounded-md bg-[var(--glass2)] px-2 py-0.5 font-mono text-[11px] text-ink2"
            >
              {g}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
