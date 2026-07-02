import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5",
        className,
      )}
      {...props}
    />
  );
}
