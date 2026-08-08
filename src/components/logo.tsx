import Image from "next/image";

export function SokeLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Soke Logo"
      width={64}
      height={64}
      className={className}
      priority
    />
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
