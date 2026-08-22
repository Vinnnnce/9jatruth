import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured =
  clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

const SUPER_ADMIN_EMAIL = "9jatruthofficial@gmail.com";

// ─── Launch Countdown Gate ───────────────────────────────────
// The site is gated until Friday, 21 August 2026, 00:00 Africa/Lagos (WAT, UTC+1).
// Until then, all traffic is redirected to /countdown (waitlist signup page).
// After launch, the gate is disabled and the site is fully accessible.
//
// To bypass the gate (e.g. for admin testing), set BYPASS_LAUNCH_GATE=true in env.
const LAUNCH_DATE_ISO = "2026-08-21T00:00:00+01:00"; // 2026-08-21 00:00 WAT
const BYPASS_GATE = process.env.BYPASS_LAUNCH_GATE === "true";

function isBeforeLaunch(): boolean {
  if (BYPASS_GATE) return false;
  return Date.now() < new Date(LAUNCH_DATE_ISO).getTime();
}

// Routes that are ALWAYS accessible (even before launch)
const isPreLaunchRoute = createRouteMatcher([
  "/countdown(.*)",
  "/faq(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/waitlist(.*)",
  "/api/webhook(.*)",
  "/api/health(.*)",
  "/api/security/analyze(.*)",
  // CRON-triggered routes — each enforces CRON_SECRET at the route level, so
  // they are safe to run before launch (needed for nightly jobs + the daily
  // security alerting sweep). Without this the pre-launch gate 503s them.
  "/api/backup(.*)",
  "/api/security/alerts(.*)",
  "/api/news/auto-summary(.*)",
  "/api/schedule/process(.*)",
  "/_next(.*)",
  "/favicon(.*)",
  "/manifest(.*)",
  "/icon(.*)",
  "/apple-touch-icon(.*)",
]);

// Public routes — accessible without authentication (post-launch)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook(.*)",
  "/api/health(.*)",
  "/api/neighborhoods(.*)",
  "/api/truths(.*)", // GET truths is public (community feed), writes are auth-checked in route
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
  "/api/ai/feed-predictions(.*)", // GET is public (feed display), POST is rate-limited
  "/api/feed(.*)", // Feed snapshots and suggestions are public
  "/api/maps(.*)", // Maps nearby is public
  "/api/ai/time-series(.*)", // Historical data is public
  "/api/feedback(.*)", // POST is public (anyone can submit feedback)
  "/api/questionnaire(.*)", // POST is public (anyone can submit questionnaire)
  "/api/backup(.*)", // Cron-triggered daily backup (protected by CRON_SECRET)
  "/api/waitlist(.*)",
  "/api/security/analyze(.*)", // Public content analysis (rate-limited)
  "/api/security/alerts(.*)", // Cron-triggered alerting sweep (CRON_SECRET)
  "/faq(.*)",
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
  "/api/auth/2fa(.*)",
  "/api/security/me(.*)",
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
// User-only pages — require a signed-in user. Truth/news writes are also
// auth-checked at the route handler, so /submit and /news/create must be
// protected here to keep the creation flows behind authentication.
const isUserRoute = createRouteMatcher([
  "/user(.*)",
  "/security(.*)",
  "/account(.*)",
  "/profile(.*)",
  "/advanced-settings(.*)",
  "/settings(.*)",
  "/dashboard(.*)",
  "/submit(.*)",
  "/news/create(.*)",
  "/activity(.*)",
  "/rewards(.*)",
]);

// When Clerk is not configured, use a pass-through middleware
const passThrough = () => NextResponse.next();

const middleware = isClerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      // ─── Launch gate: redirect to countdown if before launch date ───
      if (isBeforeLaunch() && !isPreLaunchRoute(req)) {
        // Block all non-pre-launch API calls during countdown
        const isApiCall = req.nextUrl.pathname.startsWith("/api/");
        if (isApiCall) {
          return NextResponse.json(
            { message: "Site launches August 21, 2026" },
            { status: 503 }
          );
        }
        return NextResponse.redirect(new URL("/countdown", req.url));
      }

      // Protect admin, org, and user dashboard pages — require authentication
      if (isAdminRoute(req) || isOrgRoute(req) || isUserRoute(req)) {
        await auth.protect();
      }

      // Protect sensitive API routes
      if (isAdminApiRoute(req) || isOrgApiRoute(req) || isUserApiRoute(req)) {
        await auth.protect();
      }
    })
  : (async (req: NextRequest) => {
      // ─── Launch gate without Clerk ───
      if (isBeforeLaunch() && !isPreLaunchRoute(req)) {
        const isApiCall = req.nextUrl.pathname.startsWith("/api/");
        if (isApiCall) {
          return NextResponse.json(
            { message: "Site launches August 21, 2026" },
            { status: 503 }
          );
        }
        return NextResponse.redirect(new URL("/countdown", req.url));
      }
      return NextResponse.next();
    });

export default middleware;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|webmanifest|apk)).*)",
    "/(api)(.*)",
  ],
};
