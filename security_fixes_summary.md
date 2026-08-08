# Security Audit & Fixes Summary

Date: 2026-08-08
App: Soke (Next.js 15 App Router, Clerk auth, Drizzle/Neon Postgres)

This document summarizes all authentication, authorization, CSRF, and mass-assignment
hardening applied to the API routes. Only API route files, `src/lib/neon-storage.ts`,
`shared/schema.ts`, and the new `src/lib/security.ts` were modified. No files under
`src/app/(dashboard)/` or `src/components/` were touched.

---

## 1. New file: `src/lib/security.ts`

Added a framework-agnostic CSRF / same-origin helper:

- `assertSameOrigin(request)` — returns `true` when the request's `origin` header
  resolves to the same host as the `host` header; `false` when either is missing or
  they differ.
- `csrfCheck(request)` — returns `null` for safe methods (`GET`/`HEAD`) and for
  same-origin mutating requests; otherwise returns a `403` `Response` with
  `{ message: "Cross-origin request blocked" }`.

`csrfCheck` is invoked at the top of every mutating handler (POST/PATCH/DELETE).

---

## 2. CSRF / same-origin protection

`const csrfError = csrfCheck(request); if (csrfError) return csrfError;` was added to
the first line (after `ensureDbInitialized()`) of every POST/PATCH/DELETE handler in:

- `src/app/api/org/members/route.ts` (POST)
- `src/app/api/org/members/[id]/route.ts` (PATCH, DELETE)
- `src/app/api/org/vacancies/route.ts` (POST)
- `src/app/api/org/vacancies/[id]/route.ts` (PATCH, DELETE)
- `src/app/api/org/vacancies/[id]/applications/route.ts` (POST)
- `src/app/api/truths/[id]/route.ts` (DELETE — new handler)
- `src/app/api/truths/[id]/verify/route.ts` (POST)
- `src/app/api/predictions/generate/route.ts` (POST)
- `src/app/api/push/subscribe/route.ts` (POST)
- `src/app/api/push/unsubscribe/route.ts` (POST)
- `src/app/api/rewards/redeem/route.ts` (POST)
- `src/app/api/models/batch-decay/route.ts` (POST)
- `src/app/api/models/pattern-detect/route.ts` (POST)
- `src/app/api/models/predictive-outage/route.ts` (POST)
- `src/app/api/models/verify-report/route.ts` (POST)
- `src/app/api/models/location-check/route.ts` (POST)
- `src/app/api/account/settings/route.ts` (PATCH)

---

## 3. Org admin routes — auth + IDOR hardening

**Note on the auth pattern:** the task referenced `getOrgAuthContext`, which does not
exist in this codebase. The reference route (`/api/organizations/me/truths/route.ts`)
uses `getAgencyAccountByClerkId`. The org routes here operate on `platform_users`
(which carry `organization_id`) rather than `agency_accounts`, so they already
authenticated via `getClerkUserId()` + `getPlatformUserOrgId()` / `getPlatformUserByClerkId()`.
That existing org-membership auth was **retained and verified**; CSRF + IDOR fixes were
layered on top. Switching these routes to `getAgencyAccountByClerkId` was deliberately
avoided because it would require membership in the `agency_accounts` table and would
break the org-member/vacancy features, which are modeled on `platform_users`.

**IDOR (insecure direct object reference) fixes** — these were the most serious gap.
Previously the routes verified the *caller* had an org, but never verified the *target
resource* belonged to that org. An authenticated user in org A could mutate/delete a
member or vacancy belonging to org B by simply guessing its numeric id. Fixed by:

- Adding `getOrgMemberById(id)` and `getVacancyById(id)` helpers to
  `src/lib/neon-storage.ts` (return the row including `organization_id`).
- In each mutating/GET handler, fetching the target resource and returning `403`
  ("Forbidden — resource outside your organization") when
  `resource.organization_id !== callerOrgId`.

Files updated:

- `src/app/api/org/members/route.ts`
  - GET: unchanged auth (already org-scoped).
  - POST: added CSRF check.
- `src/app/api/org/members/[id]/route.ts`
  - PATCH: CSRF check + IDOR guard (member must be in caller's org).
  - DELETE: CSRF check + IDOR guard.
- `src/app/api/org/vacancies/route.ts`
  - GET: unchanged auth (already org-scoped).
  - POST: CSRF check.
- `src/app/api/org/vacancies/[id]/route.ts`
  - PATCH: CSRF check + IDOR guard (vacancy must be in caller's org).
  - DELETE: CSRF check + IDOR guard.
- `src/app/api/org/vacancies/[id]/applications/route.ts`
  - GET: added org-membership auth (`getPlatformUserOrgId`) + IDOR guard that the
    vacancy belongs to the caller's org (previously it only checked the user was
    signed in, not that they were an org member or owned the vacancy).
  - POST (application submission): added CSRF check and now requires a signed-in
    user (`getClerkUserId` 401 if absent) — previously accepted anonymous
    submissions (`clerkUserId || null`).

---

## 4. Auth-required (signed-in user) routes

`getClerkUserId()` 401 guard + CSRF added:

- `src/app/api/truths/[id]/route.ts` — **new DELETE handler** added (none existed).
  Requires auth via `getClerkUserId()`, validates the id param, and calls the new
  `deleteTruth(id)` helper. GET remains public.
- `src/app/api/truths/[id]/verify/route.ts` — POST now requires a signed-in user.
- `src/app/api/predictions/generate/route.ts` — POST signature changed from `POST()`
  to `POST(request: Request)` to enable CSRF; requires auth.
- `src/app/api/push/subscribe/route.ts` — POST requires auth + CSRF.
- `src/app/api/push/unsubscribe/route.ts` — POST requires auth + CSRF.
- `src/app/api/rewards/redeem/route.ts` — POST requires auth + CSRF (important:
  reward redemption was previously callable by unauthenticated clients).

New storage helper added to `src/lib/neon-storage.ts`:

- `deleteTruth(id: number): Promise<boolean>` — hard-deletes a single micro_truth by
  id and returns whether a row was removed (`DELETE ... RETURNING id`).

---

## 5. Super-admin-only routes

`isSuperAdmin()` 403 guard + CSRF added to:

- `src/app/api/models/batch-decay/route.ts` (POST)
- `src/app/api/models/pattern-detect/route.ts` (POST)
- `src/app/api/models/predictive-outage/route.ts` (POST)
- `src/app/api/models/verify-report/route.ts` (POST)
- `src/app/api/models/location-check/route.ts` (POST)
- `src/app/api/models/time-decay/[truthId]/route.ts` (GET)

**Note on `predictive-outcome`:** the task listed `models/predictive-outcome/route.ts`,
but no such file/directory exists in the repo. The actual route is
`models/predictive-outage/route.ts`, which was hardened. (The
`models/predictive-outcome/` directory does not exist, so there was nothing to
protect under that exact path.)

`isSuperAdmin` is imported from `@/lib/admin-auth` (already present in the codebase;
the function uses Clerk `currentUser()` email allow-listing with an env-var fallback).

---

## 6. Mass-assignment hardening — `src/app/api/account/settings/route.ts`

Audit of `shared/schema.ts`:

- `agencyUpdateSchema` (lines 428–438) defines ONLY:
  `displayName, contactEmail, contactPhone, website, description, region, city,
  currentPassword, newPassword`. It does **not** include `isAdmin`, `isOrgAdmin`,
  `organizationId`, `role`, `trustScore`, `active`, or `verified`. Zod strips
  unknown keys by default, so the schema itself is not vulnerable to mass assignment.
- `updateAgencyAccount()` only accepts `displayName` / `passwordHash` / `lastLoginAt`,
  so even a malicious payload could not escalate privileges through it.

Defense-in-depth added anyway:

- Added a `SENSITIVE_ACCOUNT_FIELDS` allow-list block-list
  (`isAdmin, isOrgAdmin, organizationId, role, trustScore, active, verified`).
- After parsing, the handler explicitly rejects (HTTP 400) if any sensitive field
  appears in either the validated `data` or the raw `body` — guarding against any
  future schema regression.
- Added the CSRF check to the PATCH handler.

---

## 7. Storage-layer additions (`src/lib/neon-storage.ts`)

- `getOrgMemberById(id)` — fetch an org member row (used for IDOR guard).
- `getVacancyById(id)` — fetch a vacancy row (used for IDOR guard).
- `deleteTruth(id)` — hard-delete a single truth (used by the new DELETE route).

These are additive; existing function signatures were left unchanged, so no other
callers are affected.

---

## 8. Verification

- `npx tsc --noEmit` reports **no type errors** in any modified file. The only
  type errors in the project are pre-existing ones in
  `src/app/(dashboard)/profile/page.tsx` (`myEntry possibly undefined`), which is
  outside the permitted edit scope. The `TS6053: File '.next/types/...' not found`
  lines are stale Next.js generated-type references affecting every route
  (touched or not) and are an environment artifact, not a code error.

---

## Files modified

Created:
- `src/lib/security.ts`

Modified (API routes):
- `src/app/api/org/members/route.ts`
- `src/app/api/org/members/[id]/route.ts`
- `src/app/api/org/vacancies/route.ts`
- `src/app/api/org/vacancies/[id]/route.ts`
- `src/app/api/org/vacancies/[id]/applications/route.ts`
- `src/app/api/truths/[id]/route.ts`
- `src/app/api/truths/[id]/verify/route.ts`
- `src/app/api/predictions/generate/route.ts`
- `src/app/api/push/subscribe/route.ts`
- `src/app/api/push/unsubscribe/route.ts`
- `src/app/api/rewards/redeem/route.ts`
- `src/app/api/models/batch-decay/route.ts`
- `src/app/api/models/pattern-detect/route.ts`
- `src/app/api/models/predictive-outage/route.ts`
- `src/app/api/models/verify-report/route.ts`
- `src/app/api/models/location-check/route.ts`
- `src/app/api/models/time-decay/[truthId]/route.ts`
- `src/app/api/account/settings/route.ts`

Modified (lib):
- `src/lib/neon-storage.ts` (additive helpers only)
