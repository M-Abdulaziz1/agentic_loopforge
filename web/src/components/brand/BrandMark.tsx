/**
 * LoopForge emblem — a forged loop: a gradient ring with a clockwise iteration
 * arrowhead around a glowing core, set in a soft glass tile. Crisp at any size.
 */
export function BrandMark({ size = 40, glow = true }: { size?: number; glow?: boolean }) {
  const id = "lf-mark";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      style={glow ? { filter: "drop-shadow(0 4px 16px rgba(138,108,255,.55))" } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b9a3ff" />
          <stop offset="0.55" stopColor="#8a6cff" />
          <stop offset="1" stopColor="#4ad6ff" />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="0.5" cy="0.42" r="0.6">
          <stop stopColor="#f3efff" />
          <stop offset="1" stopColor="#7d63ff" />
        </radialGradient>
      </defs>

      {/* glass tile */}
      <rect
        x="2.5"
        y="2.5"
        width="35"
        height="35"
        rx="11"
        fill="rgba(138,108,255,0.12)"
        stroke={`url(#${id}-g)`}
        strokeWidth="1.6"
      />
      {/* loop ring */}
      <circle cx="20" cy="20" r="8.4" stroke={`url(#${id}-g)`} strokeWidth="2.6" />
      {/* clockwise iteration arrowhead at top-right of the ring */}
      <path
        d="M20 9.6 L26.3 11.1 L23.4 16.8 Z"
        fill={`url(#${id}-g)`}
        stroke="var(--bg0)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* glowing core */}
      <circle cx="20" cy="20" r="3.1" fill={`url(#${id}-core)`} />
    </svg>
  );
}
