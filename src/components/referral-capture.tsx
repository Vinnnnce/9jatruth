"use client";

import { useEffect } from "react";

/**
 * ReferralCapture — silently records a referral when a user lands with a
 * `?ref=CODE` (or a previously stored code). Runs once per session after the
 * user is authenticated. Failures (already-referred, self-referral, anon) are
 * ignored silently — the backend is the source of truth.
 */
export function ReferralCapture() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let code: string | null = null;
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get("ref");
      if (fromUrl) {
        code = fromUrl;
        // Persist so a sign-up that happens on a later navigation still credits.
        window.localStorage.setItem("9jat_ref", fromUrl);
        // Clean the URL.
        url.searchParams.delete("ref");
        window.history.replaceState({}, "", url.toString());
      } else {
        code = window.localStorage.getItem("9jat_ref");
      }
    } catch {
      return;
    }

    if (!code) return;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    (async () => {
      try {
        const res = await fetch("/api/rewards/referrals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referrerCode: code }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.ok) {
            // Successfully recorded — clear the stored code.
            window.localStorage.removeItem("9jat_ref");
          }
        }
      } catch {
        // Network/abort — leave the code stored so a later attempt can retry.
      } finally {
        clearTimeout(t);
      }
    })();
  }, []);

  return null;
}
