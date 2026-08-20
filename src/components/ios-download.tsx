"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Apple, X, Share, PlusSquare, Download } from "lucide-react";

// 9jatruth is a Progressive Web App. On iOS, installation happens via
// Safari's "Add to Home Screen" — there is no App Store listing yet.
// This banner guides users through that flow and is hidden once the app
// is already running in standalone (installed) mode.

function detectIOS(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.platform || "";
  const isIPad =
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && "ontouchend" in document && (navigator.maxTouchPoints || 0) > 1);
  const isIPhone = /iPhone|iPod/.test(ua);
  return isIPad || isIPhone;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    // iOS Safari standalone flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function IosDownload() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!detectIOS() || isStandalone()) return;
    try {
      const stored = window.localStorage.getItem("9jatruth_ios_banner_dismissed");
      if (stored === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      // localStorage may be unavailable
    }
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    try {
      window.localStorage.setItem("9jatruth_ios_banner_dismissed", "1");
    } catch {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      {show && !dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-40 px-4 pt-3"
        >
          <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card shadow-lg p-3 flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2 shrink-0">
              <Apple className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight">Install 9jatruth on your iPhone</p>
              <p className="text-[10px] text-muted-foreground">Add it to your Home Screen for the full app experience</p>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/15 p-1.5">
                    <Apple className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="text-sm font-semibold">Install 9jatruth</h2>
                </div>
                <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                9jatruth is a Progressive Web App. Install it from Safari in three steps — no App Store needed.
              </p>

              <ol className="space-y-3">
                <Step n={1} title="Tap the Share button" icon={Share} hint="It's the square with an up arrow in Safari's toolbar." />
                <Step n={2} title="Choose “Add to Home Screen”" icon={PlusSquare} hint="Scroll the share sheet down to find it." />
                <Step n={3} title="Tap “Add”" icon={Apple} hint="9jatruth appears on your Home Screen like a native app." />
              </ol>

              <button
                onClick={() => {
                  setOpen(false);
                  handleDismiss();
                }}
                className="w-full rounded-md bg-primary text-primary-foreground py-2 text-xs font-medium hover:bg-primary/90"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}

function Step({ n, title, hint, icon: Icon }: { n: number; title: string; hint: string; icon: typeof Share }) {
  return (
    <li className="flex items-start gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium">{title}</span>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>
      </div>
    </li>
  );
}

export default IosDownload;
