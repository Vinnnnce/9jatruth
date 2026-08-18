"use client";

import { SignIn } from "@clerk/nextjs";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured =
  clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

export default function SignInPage() {
  // If Clerk is not configured, show a message
  if (!isClerkConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Welcome to 9jatruth</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Authentication is not yet configured.
            </p>
            <p className="mt-4 text-xs text-muted-foreground/70">
              Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in your
              environment variables to enable sign-in.
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
          <h1 className="text-2xl font-bold text-foreground">Welcome to 9jatruth</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card border border-border shadow-lg rounded-lg w-full",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90",
              formFieldInput:
                "bg-background border-border text-foreground",
              footerActionLink: "text-primary hover:text-primary/80",
              identityPreviewText: "text-foreground",
              identityPreviewEditButton: "text-primary",
            },
          }}
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/feeds"
          forceRedirectUrl="/feeds"
        />
      </div>
    </div>
  );
}
