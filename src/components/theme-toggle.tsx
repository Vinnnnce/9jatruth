"use client";

import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-center gap-1.5" data-testid="container-theme-toggle">
      <Sun className={`h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-40" : "opacity-100"}`} />
      <Switch
        checked={isDark}
        onCheckedChange={toggleTheme}
        data-testid="button-theme-toggle"
        aria-label="Toggle dark mode"
        className="scale-90"
      />
      <Moon className={`h-3.5 w-3.5 transition-opacity ${isDark ? "opacity-100" : "opacity-40"}`} />
    </div>
  );
}
