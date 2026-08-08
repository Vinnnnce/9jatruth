import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

const SUPER_ADMIN_EMAIL = "insights793@gmail.com";

// Public routes — accessible without authentication
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  "/api/health(.*)",
  "/api/neighborhoods(.*)",
  "/api/truths(.*)",  // GET truths is public (community feed), writes are auth-checked in route
  "/api/dashboard(.*)",
  "/api/trends(.*)",
  "/api/search(.*)",
  "/api/activity(.*)",
  "/api/alerts(.*)",
  "/api/leaderboard(.*)",
  "/api/predictions(.*)",
  "/api/geo(.*)",
  "/api/organizations(.*)",
  "/api/push/vapid-key(.*)",
  "/api/ai/feed-predictions(.*)",  // GET is public (feed display), POST is rate-limited
  "/api/ai/time-series(.*)",  // Historical data is public
]);

// Admin-only API routes — require super admin email
const isAdminApiRoute = createRouteMatcher([
  "/api/admin(.*)",
  "/api/track(.*)",
  "/api/models(.*)",
  "/api/truths/delete(.*)",
  "/api/analytics/overview(.*)",
  "/api/ai/aggregate(.*)",
]);

// Org-only API routes — require org admin auth
const isOrgApiRoute = createRouteMatcher([
  "/api/org(.*)",
  "/api/organizations/me(.*)",
]);

// User-only API routes — require signed-in user
const isUserApiRoute = createRouteMatcher([
  "/api/notifications(.*)",
  "/api/account(.*)",
  "/api/auth/me(.*)",
  "/api/rewards/redeem(.*)",
  "/api/push/subscribe(.*)",
  "/api/push/unsubscribe(.*)",
  "/api/sync(.*)",
  "/api/ingest(.*)",
  "/api/gamification(.*)",
  "/api/user(.*)",
  "/api/analytics/user(.*)",
  "/api/users(.*)/subscribe",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isOrgRoute = createRouteMatcher(["/org(.*)"]);
const isUserRoute = createRouteMatcher(["/user(.*)"]);

// When Clerk is not configured, use a pass-through middleware
const passThrough = () => NextResponse.next();

const middleware = isClerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      // Protect admin, org, and user dashboard pages — require authentication
      if (isAdminRoute(req) || isOrgRoute(req) || isUserRoute(req)) {
        await auth.protect();
      }

      // Protect sensitive API routes
      if (isAdminApiRoute(req) || isOrgApiRoute(req) || isUserApiRoute(req)) {
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
