"use client";

import { useState, useEffect } from "react";
import { Cookie, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "soke_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAction = (action: "accepted" | "declined") => {
    localStorage.setItem(STORAGE_KEY, action);
    setClosing(true);
    setTimeout(() => setVisible(false), 400);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 left-4 md:left-auto md:w-[420px] z-[100] ${
        closing ? "animate-[slide-down-fade_0.4s_ease-in_forwards]" : "animate-[slide-up-fade_0.5s_ease-out_forwards]"
      }`}
    >
      <div className="rounded-xl border border-border bg-card shadow-2xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">We use cookies</h3>
              <p className="text-xs text-muted-foreground">Your privacy matters to us</p>
            </div>
          </div>
          <button
            onClick={() => handleAction("declined")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Soke uses cookies to improve your experience, analyze traffic, and provide community features.
          By continuing to browse, you agree to our use of cookies.
        </p>
        <div className="flex items-center gap-2">
          <a
            href="/cookies"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ShieldCheck className="h-3 w-3" />
            Learn more
          </a>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction("declined")}
            className="h-8 text-xs"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={() => handleAction("accepted")}
            className="h-8 text-xs"
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
