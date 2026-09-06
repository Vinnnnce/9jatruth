"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Detects when the Clerk JS SDK loads its <SignIn/>/<SignUp/> widget but
 * never reaches `loaded: true` (e.g. the production origin is not in Clerk's
 * Allowed Origins, so the SDK's /v1/client call is rejected). In that case
 * the widget would otherwise render nothing — this boundary shows a clear,
 * actionable message instead of a blank page.
 *
 * Requires Clerk to be configured (isClerkConfigured). Wrap the Clerk
 * auth component children with this boundary.
 */
export function ClerkAuthBoundary({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded && !timedOut) {
    return (
      <div className="flex w-full items-center justify-center py-16" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
          <p className="text-sm text-muted-foreground">Loading secure sign-in…</p>
        </div>
      </div>
    );
  }

  if (!isLoaded && timedOut) {
    // Clerk failed to initialize. The production origin (e.g. https://www.9jatruth.com)
    // is not listed in the Clerk dashboard's Allowed Origins, so the SDK's
    // /v1/client request is rejected (403) and the <SignIn/> widget never mounts.
    // This is a Clerk dashboard configuration fix (add the www origin), not
    // something we can resolve from the client. Show a clear message + retry.
    return (
      <div className="w-full rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <h2 className="text-base font-semibold text-foreground">
          Sign-in is taking longer than expected
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The secure sign-in service is temporarily unavailable while the
          sign-in domain is being approved. Please try again in a moment.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/feeds"
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Back to feeds
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
