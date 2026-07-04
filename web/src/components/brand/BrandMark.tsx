/**
 * LoopForge emblem — a forged loop: an ink iteration ring with a clockwise
 * arrowhead around a solid core, on a solid ink tile. Monochrome and flat,
 * matching Vercel's black-and-white brand — the mark carries no color.
 */
export function BrandMark({ size = 40 }: { size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      {/* solid ink tile */}
      <rect x="1" y="1" width="38" height="38" rx="9" fill="var(--ink)" />
      {/* loop ring */}
      <circle cx="20" cy="20" r="8.4" stroke="var(--on-ink)" strokeWidth="2.6" />
      {/* clockwise iteration arrowhead at top-right of the ring */}
      <path
        d="M20 9.6 L26.3 11.1 L23.4 16.8 Z"
        fill="var(--on-ink)"
        stroke="var(--ink)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* core */}
      <circle cx="20" cy="20" r="3" fill="var(--on-ink)" />
    </svg>
  );
}
