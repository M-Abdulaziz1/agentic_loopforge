/**
 * LoopForge emblem — a forged loop: an orange iteration ring with a clockwise
 * arrowhead around a solid core, set on a hairline cream tile. Editorial, flat,
 * no glow — depth comes from the hairline, matching the Cursor system.
 */
export function BrandMark({ size = 40 }: { size?: number; glow?: boolean }) {
  const id = "lf-mark";
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      {/* cream tile with hairline */}
      <rect
        x="1.5"
        y="1.5"
        width="37"
        height="37"
        rx="10"
        fill="#ffffff"
        stroke="rgba(38,37,30,0.14)"
        strokeWidth="1"
      />
      {/* loop ring */}
      <circle cx="20" cy="20" r="8.4" stroke="var(--violet)" strokeWidth="2.6" />
      {/* clockwise iteration arrowhead at top-right of the ring */}
      <path
        d="M20 9.6 L26.3 11.1 L23.4 16.8 Z"
        fill="var(--violet)"
        stroke="#ffffff"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* core */}
      <circle cx="20" cy="20" r="3" fill={`url(#${id}-core)`} />
      <defs>
        <radialGradient id={`${id}-core`} cx="0.5" cy="0.42" r="0.7">
          <stop stopColor="#ff7a3c" />
          <stop offset="1" stopColor="var(--violet)" />
        </radialGradient>
      </defs>
    </svg>
  );
}
