import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

/*
 * The single button primitive. Every CTA routes through here so weight, radius,
 * padding, and hover/active/focus/disabled states stay identical. Vercel's app
 * dialect: a tight 6px square, ink-black primary, white-hairline secondary, and
 * the accent blue for positive actions — enforced once, not per call site.
 */
const BASE =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium " +
  "transition duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-[var(--on-ink)] hover:bg-[var(--ink-hover)]",
  secondary:
    "border border-[var(--line2)] bg-[var(--surface)] text-ink hover:bg-[var(--canvas-soft)]",
  ghost: "text-ink2 hover:bg-[var(--glass2)] hover:text-ink",
  danger:
    "border border-[color-mix(in_srgb,var(--bad)_28%,var(--line))] bg-[var(--surface)] " +
    "text-bad hover:bg-[color-mix(in_srgb,var(--bad)_8%,var(--surface))] hover:border-[color-mix(in_srgb,var(--bad)_45%,var(--line))]",
  success: "bg-accent text-white hover:bg-[var(--accent-deep)]",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-[18px] text-[14px]",
  lg: "h-11 px-5 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
