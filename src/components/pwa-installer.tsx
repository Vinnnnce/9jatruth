"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

/**
 * PWA Installer Component
 *
 * Registers the service worker and shows an install prompt when the app
 * is installable. Also provides a "Download App" button in the UI.
 */
export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for updates every hour
          setInterval(() => reg.update(), 60 * 60 * 1000);
        })
        .catch(() => {
          // SW registration failed — non-fatal
        });
    }

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setInstalled(true);
      setShowInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
    }
    setDeferredPrompt(null);
    setShowInstall(false);
  };

  if (installed) return null;

  return (
    <>
      {/* Install banner — shown when PWA is installable */}
      {showInstall && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 animate-fade-in">
          <div className="rounded-lg border bg-card shadow-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">Install Soke App</p>
                  <p className="text-[10px] text-muted-foreground">
                    Quick access from your home screen
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInstall(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" onClick={handleInstall} className="w-full gap-2">
              <Download className="h-3.5 w-3.5" />
              Install App
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
