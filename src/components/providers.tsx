"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from "@clerk/nextjs";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ReactNode } from "react";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

export function Providers({ children }: { children: ReactNode }) {
  const content = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          {children}
          {/* Vercel Speed Insights — real-user performance metrics in production */}
          <SpeedInsights />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  if (isClerkConfigured) {
    return <ClerkProvider>{content}</ClerkProvider>;
  }

  return content;
}
