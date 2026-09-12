import Image from "next/image";

export function SokeLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="9jatruth Logo"
      width={64}
      height={64}
      className={className}
      priority
    />
  );
}

export function SokeLogoFull({ className = "h-7" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
      <SokeLogo className="h-7 w-7 shrink-0" />
      <div className="flex flex-col leading-none min-w-0 group-data-[collapsible=icon]:hidden">
        <span className="font-display font-700 text-sm tracking-tight whitespace-nowrap">9jatruth</span>
        <span className="text-[10px] text-muted-foreground tracking-wider uppercase whitespace-nowrap">Eyes on the Street</span>
      </div>
    </div>
  );
}

// Backward-compatible aliases
export const CrlLogo = SokeLogo;
export const CrlLogoFull = SokeLogoFull;
