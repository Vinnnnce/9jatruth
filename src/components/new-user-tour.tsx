"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOUR_KEY = "soke_tour_completed";

const TOUR_STEPS = [
  {
    title: "Welcome to Soke",
    description: "Soke — Eyes on the Street is a community-powered platform for reporting and tracking local conditions across Nigeria. Let's take a quick tour.",
    icon: "👋",
  },
  {
    title: "Submit a Report",
    description: "Share what you see in your community — power outages, security updates, traffic, market prices, and more. Your reports help your neighborhood stay informed.",
    actionUrl: "/submit",
    cta: "Go to Submit",
    icon: "📝",
  },
  {
    title: "Browse Community Feeds",
    description: "See real-time reports from your area. Filter by category, location, and time to find the information that matters to you.",
    actionUrl: "/feeds",
    cta: "View Feeds",
    icon: "📊",
  },
  {
    title: "Track on the Map",
    description: "Visualize reports geographically. See clusters of activity and trends across neighborhoods, LGAs, and states.",
    actionUrl: "/map",
    cta: "Open Map",
    icon: "🗺️",
  },
  {
    title: "Earn Rewards",
    description: "Contribute verified reports to earn rewards. Climb the leaderboard and help build a more informed community.",
    actionUrl: "/rewards",
    cta: "See Rewards",
    icon: "🏆",
  },
  {
    title: "Your Profile",
    description: "Track your contributions, rewards, and activity history. Your location is auto-detected based on your IP address.",
    actionUrl: "/profile",
    cta: "View Profile",
    icon: "👤",
  },
  {
    title: "Stay Safe, Stay Informed",
    description: "Soke is powered by community contributions. Every report counts. Thank you for being part of the movement.",
    icon: "🛡️",
  },
];

export function NewUserTour() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const completed = localStorage.getItem(TOUR_KEY);
      if (!completed) {
        const timer = setTimeout(() => setShow(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage not available
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(TOUR_KEY, "true");
    } catch {
      // ignore
    }
    setShow(false);
  };

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  const current = TOUR_STEPS[step];

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-md mx-4 rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted transition-colors"
          aria-label="Close tour"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="px-6 py-8 text-center">
          <div className="text-5xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-display font-700 mb-2">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {current.description}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={prev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={dismiss}>
                Skip
              </Button>
            )}

            <div className="flex items-center gap-2">
              {current.actionUrl && current.cta && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    dismiss();
                    window.location.href = current.actionUrl!;
                  }}
                >
                  {current.cta}
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {step === TOUR_STEPS.length - 1 ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/50 mt-4">
            Step {step + 1} of {TOUR_STEPS.length}
          </p>
        </div>
      </div>
    </div>
  );
}
