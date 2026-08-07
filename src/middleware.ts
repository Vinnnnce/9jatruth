import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

const SUPER_ADMIN_EMAIL = "insights793@gmail.com";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  "/api/neighborhoods(.*)",
  "/api/truths(.*)",
  "/api/dashboard(.*)",
  "/api/trends(.*)",
  "/api/search(.*)",
  "/api/activity(.*)",
  "/api/alerts(.*)",
  "/api/leaderboard(.*)",
  "/api/predictions(.*)",
  "/api/health(.*)",
  "/api/geo(.*)",
  "/api/organizations(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isOrgRoute = createRouteMatcher(["/org(.*)"]);
const isUserRoute = createRouteMatcher(["/user(.*)"]);

// When Clerk is not configured, use a pass-through middleware
const passThrough = () => NextResponse.next();

const middleware = isClerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      // Protect admin, org, and user routes — require authentication
      if (isAdminRoute(req) || isOrgRoute(req) || isUserRoute(req)) {
        await auth.protect();
      }
    })
  : passThrough;

export default middleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest|apk)).*)",
    "/(api)(.*)",
  ],
};
