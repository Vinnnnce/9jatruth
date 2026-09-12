"use client";

import { SignUp } from "@clerk/nextjs";
import { ClerkAuthBoundary } from "@/components/clerk-auth-boundary";
import { FallbackAuthForm } from "@/components/fallback-auth-form";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured =
  clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

export default function SignUpPage() {
  // If Clerk is not configured, show the fallback email/password form
  if (!isClerkConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Join 9jatruth</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account to start reporting and verifying truths
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <FallbackAuthForm mode="signup" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Join 9jatruth</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account to start reporting and verifying truths
          </p>
        </div>
        <ClerkAuthBoundary>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card border border-border shadow-lg rounded-lg w-full",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90",
              formFieldInput:
                "bg-background border-border text-foreground placeholder:text-muted-foreground/70",
              formFieldLabel: "text-muted-foreground",
              footerActionLink: "text-primary hover:text-primary/80",
              identityPreviewText: "text-foreground",
              identityPreviewEditButton: "text-primary",
            },
          }}
          signInUrl="/sign-in"
          fallbackRedirectUrl="/feeds"
          forceRedirectUrl="/feeds"
        />
        </ClerkAuthBoundary>
      </div>
    </div>
  );
}
