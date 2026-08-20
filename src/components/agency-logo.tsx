import { EmergencyAgency } from "@/lib/emergency-agencies";

/**
 * AgencyLogo — a distinctive, branded SVG badge for each Nigerian
 * emergency agency. Renders a rounded shield with the agency monogram,
 * brand colour, and a thin accent ring. Pure SVG (no external assets),
 * so it works in any context without image-config or CORS concerns.
 */
export function AgencyLogo({
  agency,
  size = 48,
  className = "",
}: {
  agency: EmergencyAgency;
  size?: number;
  className?: string;
}) {
  const id = `ag-${agency.slug}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={`${agency.shortName} logo`}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={agency.color} />
          <stop offset="100%" stopColor={shade(agency.color, -28)} />
        </linearGradient>
      </defs>
      {/* Shield body */}
      <path
        d="M32 3 L57 12 V31 C57 47 46 57 32 61 C18 57 7 47 7 31 V12 Z"
        fill={`url(#${id}-g)`}
        stroke={shade(agency.color, 24)}
        strokeWidth="1.5"
      />
      {/* Inner highlight */}
      <path
        d="M32 8 L52 15 V31 C52 44 43 53 32 56 C21 53 12 44 12 31 V15 Z"
        fill="rgba(255,255,255,0.06)"
      />
      {/* Monogram */}
      <text
        x="32"
        y={agency.monogram.length >= 4 ? 37 : 39}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={agency.monogram.length >= 4 ? 13 : agency.monogram.length === 3 ? 15 : 19}
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.5"
      >
        {agency.monogram}
      </text>
      {/* Bottom accent bar */}
      <rect x="20" y="50" width="24" height="3" rx="1.5" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

/** Lighten/darken a hex colour by an integer percentage. */
function shade(hex: string, percent: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
