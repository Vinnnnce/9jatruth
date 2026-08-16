"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Apple, X, Download } from "lucide-react";

// Placeholder App Store / TestFlight link
const IOS_APP_URL = "https://apps.apple.com/app/9jatruth/id000000000";

function isIOS(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const ua = navigator.userAgent || navigator.platform || "";
  // iPadOS 13+ reports as Mac, so also check for touch + Mac
  const isIPad =
    /iPad/.test(ua) ||
    (/Macintosh/.test(ua) && "ontouchend" in document && (navigator.maxTouchPoints || 0) > 1);
  const isIPhone = /iPhone|iPod/.test(ua);
  return isIPad || isIPhone;
}

export function IosDownload() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isIOS()) return;
    try {
      const stored = window.localStorage.getItem("9jatruth_ios_banner_dismissed");
      if (stored === "1") {
        setDismissed(true);
        return;
      }
    } catch {
      // localStorage may be unavailable
    }
    // Slight delay so it appears after page load
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
              <p className="text-sm font-medium leading-tight">Get the 9jatruth app</p>
              <p className="text-[10px] text-muted-foreground">Download for iOS for the full experience</p>
            </div>
            <motion.a
              href={IOS_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{ y: [0, -2, 0] }}
              transition={{
                y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </motion.a>
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
    </AnimatePresence>
  );
}

export default IosDownload;
