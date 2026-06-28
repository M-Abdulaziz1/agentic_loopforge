import { cn } from "../../lib/cn";

type MeterBarProps = {
  label: string;
  value: string;
  /** 0..1 fill fraction */
  fraction: number;
  warn?: boolean;
};

export function MeterBar({ label, value, fraction, warn }: MeterBarProps) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return (
    <div className="min-w-[150px]">
      <div className="mb-1.5 flex justify-between text-[11px] tracking-[.3px] text-mut">
        <span>{label}</span>
        <b className="font-mono text-ink">{value}</b>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded",
            warn
              ? "bg-gradient-to-r from-[#ffb24d] to-warn"
              : "bg-gradient-to-r from-violet to-teal",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
