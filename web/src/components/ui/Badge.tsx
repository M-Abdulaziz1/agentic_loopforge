import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type Tone = "neutral" | "brand" | "ok" | "warn" | "bad";

/*
 * Status pill, Vercel dialect: a white hairline-bordered capsule with a small
 * tone-colored dot and a grey/ink label — the deployment-status look, not a
 * saturated fill. Color lives in the dot and text tier, never the surface.
 */
const TEXT: Record<Tone, string> = {
  neutral: "text-mut",
  brand: "text-accent",
  ok: "text-accent",
  warn: "text-[var(--warning-deep,#ab570a)]",
  bad: "text-bad",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-mut",
  brand: "bg-accent",
  ok: "bg-accent",
  warn: "bg-warn",
  bad: "bg-bad",
};

export function Badge({
  tone = "neutral",
  dot = true,
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
        "inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium",
        TEXT[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOT[tone])} /> : null}
      {children}
    </span>
  );
}
