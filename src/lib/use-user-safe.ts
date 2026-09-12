"use client";

import { useState, useEffect } from "react";
import { useUser as useClerkUser } from "@clerk/nextjs";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

interface FallbackUser {
  isSignedIn: boolean;
  isLoaded: boolean;
  user: {
    id: number;
    email: string;
    displayName: string;
    fullName?: string;
    username?: string;
    primaryEmailAddress?: { emailAddress: string };
    createdAt?: Date;
    imageUrl?: string | null;
  } | null;
}

/**
 * Safe wrapper around Clerk's useUser hook.
 * When Clerk is not configured, checks for fallback auth via /api/auth/me.
 */
export function useUser(): FallbackUser | ReturnType<typeof useClerkUser> {
  const [fallbackState, setFallbackState] = useState<FallbackUser>({
    isSignedIn: false,
    isLoaded: false,
    user: null,
  });

  useEffect(() => {
    if (isClerkConfigured) return;

    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.account) {
          setFallbackState({
            isSignedIn: true,
            isLoaded: true,
            user: {
              id: data.account.id,
              email: data.account.email,
              displayName: data.account.displayName,
              fullName: data.account.displayName,
              username: data.account.displayName,
              primaryEmailAddress: { emailAddress: data.account.email },
              createdAt: new Date(),
              imageUrl: null,
            },
          });
        } else {
          setFallbackState({
            isSignedIn: false,
            isLoaded: true,
            user: null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFallbackState({
            isSignedIn: false,
            isLoaded: true,
            user: null,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isClerkConfigured) {
    return fallbackState;
  }

  return useClerkUser();
}
