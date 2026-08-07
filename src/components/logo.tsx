export function SokeLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-label="Soke Logo"
    >
      <circle cx="16" cy="16" r="3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="7" stroke-opacity="0.6" />
      <circle cx="16" cy="16" r="12" stroke-opacity="0.3" />
      <circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="28" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="28" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <line x1="16" y1="7" x2="16" y2="13" stroke-opacity="0.4" />
      <line x1="23" y1="16" x2="27" y2="16" stroke-opacity="0.4" />
      <line x1="16" y1="19" x2="16" y2="25" stroke-opacity="0.4" />
      <line x1="5" y1="16" x2="9" y2="16" stroke-opacity="0.4" />
    </svg>
  );
}

export function SokeLogoFull({ className = "h-7" }: { className?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <SokeLogo className="h-7 w-7" />
      <div className="flex flex-col leading-none">
        <span className={`font-display font-700 text-sm tracking-tight`}>Soke</span>
        <span className="text-[10px] text-muted-foreground tracking-wider uppercase">Eyes on the Street</span>
      </div>
    </div>
  );
}

// Backward-compatible aliases
export const CrlLogo = SokeLogo;
export const CrlLogoFull = SokeLogoFull;
