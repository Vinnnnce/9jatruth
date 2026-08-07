"use client";

import { useUser as useClerkUser } from "@clerk/nextjs";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

/**
 * Safe wrapper around Clerk's useUser hook.
 * When Clerk is not configured, returns a safe default.
 */
export function useUser() {
  if (!isClerkConfigured) {
    return {
      user: null,
      isLoaded: true,
      isSignedIn: false,
    };
  }
  return useClerkUser();
}
