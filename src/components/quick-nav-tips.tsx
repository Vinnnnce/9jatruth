"use client";

/**
 * QuickNavigationTips Component
 *
 * Onboarding overlay shown only to new users (first visit).
 * Uses localStorage to remember that the user has seen the tips.
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, ListChecks, TrendingUp, MapPin, Building2, Trophy, Bell, Zap, ChevronRight, Lightbulb } from "lucide-react";

const STORAGE_KEY = "soke_seen_quick_tips";

const tips = [
  { icon: Send, title: "Submit Reports", description: "Report real-time conditions in your area — power outages, fuel prices, traffic, safety issues.", color: "text-amber-500" },
  { icon: MapPin, title: "Location-Based Feed", description: "Enable location access to see only posts near you. Your exact location is never stored.", color: "text-blue-500" },
  { icon: ListChecks, title: "Filter Posts", description: "Use the filter bar to narrow by category, distance, freshness, and trust score.", color: "text-purple-500" },
  { icon: TrendingUp, title: "Trust Scores", description: "Each report gets a trust score based on community verification and AI models.", color: "text-green-500" },
  { icon: Trophy, title: "Earn Rewards", description: "Submit and verify reports to earn XP, credits, and climb the leaderboard.", color: "text-orange-500" },
  { icon: Building2, title: "Agency Accounts", description: "Organizations can register for an agency account to contribute verified updates.", color: "text-cyan-500" },
  { icon: Bell, title: "Push Notifications", description: "Subscribe to alerts for specific categories and neighborhoods.", color: "text-red-500" },
];

export function QuickNavigationTips() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setOpen(true);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const handleNext = () => {
    if (step < tips.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const currentTip = tips[step];
  const Icon = currentTip.icon;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            {step === 0 ? "Welcome to Soke!" : "Quick Tips"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5">
            {tips.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
              />
            ))}
          </div>

          {/* Tip content */}
          <div className="flex flex-col items-center text-center py-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-3">
              <Icon className={`h-7 w-7 ${currentTip.color}`} />
            </div>
            <h3 className="text-sm font-medium">{currentTip.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{currentTip.description}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs">
              Skip tour
            </Button>
            <Button size="sm" onClick={handleNext} className="gap-1">
              {step < tips.length - 1 ? "Next" : "Get Started"}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
