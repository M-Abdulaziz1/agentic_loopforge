import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "neutral" | "brand" | "ok" | "warn" | "bad";

/*
 * Status pill. Uppercase caption voice with a soft tinted fill + saturated ink,
 * the same treatment Cursor uses for its timeline/badge pills. One dot optional.
 */
const TONE: Record<Tone, string> = {
  neutral: "bg-[var(--glass2)] text-ink2",
  brand: "bg-[color-mix(in_srgb,var(--violet)_12%,var(--surface))] text-violet",
  ok: "bg-[color-mix(in_srgb,var(--ok)_12%,var(--surface))] text-ok",
  warn: "bg-[color-mix(in_srgb,var(--warn)_15%,var(--surface))] text-warn",
  bad: "bg-[color-mix(in_srgb,var(--bad)_12%,var(--surface))] text-bad",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-mut",
  brand: "bg-violet",
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
};

export function Badge({
  tone = "neutral",
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.6px]",
        TONE[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOT[tone])} /> : null}
      {children}
    </span>
  );
}
