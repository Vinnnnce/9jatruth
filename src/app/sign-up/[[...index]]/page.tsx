"use client";

import { SignUp } from "@clerk/nextjs";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

export default function SignUpPage() {
  // If Clerk is not configured, show a message
  if (!isClerkConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Join Soke</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Authentication is not yet configured.
            </p>
            <p className="mt-4 text-xs text-muted-foreground/70">
              Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in your environment variables to enable sign-up.
            </p>
          </div>
          <a
            href="/"
            className="block w-full text-center py-2 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90"
          >
            Continue to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">Join Soke</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create an account to start reporting and verifying truths
          </p>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card border border-border shadow-lg rounded-lg w-full",
            },
          }}
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
