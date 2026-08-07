# API Routes Summary — Next.js App Router Port

This document summarizes all API route handlers created under `src/app/api/` as part of porting the Express backend (`soke/server/routes.ts`) to Next.js App Router Route Handlers.

## Shared Infrastructure

### `src/lib/api-helpers.ts`
Shared helpers used by every route handler:
- `getUserId(request)` — gets the Clerk user ID via `auth()` from `@clerk/nextjs/server`, hashes it (SHA-256, truncated) into a stable `dev_XXXX` userHash, with a dev fallback (`dev_1d6e`) when unauthenticated. Replaces the old `X-Visitor-Id`-based `getUserIdentity`.
- `getClerkUserId()` — returns the raw Clerk user ID (or null) for the current request.
- `getClientIp(request)` — extracts client IP from `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip` headers.
- `hashIp(ip)` — SHA-256 hash of an IP for privacy-preserving storage.
- `getIpLocation(request)` — privacy-preserving IP geolocation via ipapi.co (hashed IP + region/city/coords).
- `sanitizeText(text)` — strips HTML tags, `javascript:` URIs, and inline event handlers.
- `validate(schema, value)` — Zod validation returning `{ success, data }` or `{ success, error }`.
- `validationErrorResponse(error)` — builds a 400 JSON Response, mapping Zod issues to `{ path, message }`.
- `requireClerkAuth()` — returns the clerk user id or a 401 Response.
- `mapZodIssues(issues)` — maps a Zod issue array to `{ path, message }`.

### `src/lib/neon-storage.ts`
A comprehensive storage + service layer that ports the `NeonStorage` class (`soke/server/storage-neon.ts`) and the supporting service/model logic (`soke/server/services/*` and `soke/server/models/*`) to use the Neon serverless tagged-template SQL client from `@/lib/db` (`getDb()`). Every function assumes `ensureDbInitialized()` has been called by the route handler. Includes:
- Row mappers (snake_case DB → camelCase app) for neighborhoods, truths, organizations, agency accounts, snapshots, predictions, rewards, devices.
- Core storage: `getNeighborhoods`, `getNeighborhood`, `getTruths`, `getTruthsNearby`, `getTruth`, `createTruth`, `getDeviceProfile`, `upsertDeviceProfile`, `verifyTruth`, `getVerifications`, `getSnapshots`, `getSnapshot`, `getPredictions`, `createPrediction`, `getRewardBalance`, `getRewardLedger`, `redeemReward`, `getTrends`, `getAlerts`, `getLeaderboard`, `search`, `getActivity`, `getHealth`.
- Organizations & agency accounts: `getOrganizations`, `getOrganization`, `createOrganization`, `getAgencyAccountByEmail/ById/ByClerkId`, `createAgencyAccount`, `updateAgencyAccount`, `updateOrganizationProfile`.
- Ingestion: `ingestBatch` (sanitization, dedup, trust scoring).
- Mesh sync: `handleSyncPush`, `handleSyncPull`, `getSyncStatus`.
- Push notifications: `registerSubscription`, `unsubscribe`, `getVapidPublicKey`, `isPushConfigured`.
- Gamification: `getGamificationProfile`, `levelFromXP`, `xpToNextLevel`.
- Geo-clustering: `getClustersForNeighborhood`, `getHeatmapData`, `findClustersNearby`, `encodeGeohash`.
- AI models (ported pure logic + DB-fetching wrappers): `runReportVerification`, `runLocationConsistency`, `runTimeDecayModel`, `batchDecayTruths`, `runPatternDetection`, `runPredictiveOutageModel`.
- Prediction generation: `runAllPredictions`.
- Auth helpers: `hashPassword` / `verifyPassword` (bcrypt).
- Platform users (Clerk-synced): `upsertPlatformUser`, `getPlatformUserByClerkId`, `getPlatformUserOrgId`.
- Admin / Org management: `getAdminStats`, `getPlatformUsers`, `updatePlatformUser`, `getOrgMembers`, `addOrgMember`, `updateOrgMember`, `deleteOrgMember`, `getVacancies`, `createVacancy`, `updateVacancy`, `deleteVacancy`, `getVacancyApplications`, `createVacancyApplication`.

## Ported Route Handlers (Express → Next.js)

| Express Route | Next.js File | Method(s) |
|---|---|---|
| `/api/neighborhoods` | `neighborhoods/route.ts` | GET |
| `/api/neighborhoods/:id` | `neighborhoods/[id]/route.ts` | GET |
| `/api/truths` | `truths/route.ts` | GET, POST |
| `/api/truths/nearby` | `truths/nearby/route.ts` | GET |
| `/api/truths/:id` | `truths/[id]/route.ts` | GET |
| `/api/truths/:id/verify` | `truths/[id]/verify/route.ts` | POST |
| `/api/truths/:id/verifications` | `truths/[id]/verifications/route.ts` | GET |
| `/api/dashboard` | `dashboard/route.ts` | GET |
| `/api/dashboard/:neighborhoodId` | `dashboard/[neighborhoodId]/route.ts` | GET |
| `/api/predictions` | `predictions/route.ts` | GET |
| `/api/predictions/generate` | `predictions/generate/route.ts` | POST |
| `/api/rewards/balance` | `rewards/balance/route.ts` | GET |
| `/api/rewards/ledger` | `rewards/ledger/route.ts` | GET |
| `/api/rewards/redeem` | `rewards/redeem/route.ts` | POST |
| `/api/trends` | `trends/route.ts` | GET |
| `/api/search` | `search/route.ts` | GET |
| `/api/activity` | `activity/route.ts` | GET |
| `/api/alerts` | `alerts/route.ts` | GET |
| `/api/leaderboard` | `leaderboard/route.ts` | GET |
| `/api/health` | `health/route.ts` | GET |
| `/api/track/ip` | `track/ip/route.ts` | GET |
| `/api/ingest/batch` | `ingest/batch/route.ts` | POST |
| `/api/sync/push` | `sync/push/route.ts` | POST |
| `/api/sync/pull` | `sync/pull/route.ts` | GET |
| `/api/sync/status` | `sync/status/route.ts` | GET |
| `/api/push/subscribe` | `push/subscribe/route.ts` | POST |
| `/api/push/unsubscribe` | `push/unsubscribe/route.ts` | POST |
| `/api/push/vapid-key` | `push/vapid-key/route.ts` | GET |
| `/api/gamification/profile` | `gamification/profile/route.ts` | GET |
| `/api/geo/clusters` | `geo/clusters/route.ts` | GET |
| `/api/geo/nearby` | `geo/nearby/route.ts` | GET |
| `/api/models/verify-report` | `models/verify-report/route.ts` | POST |
| `/api/models/location-check` | `models/location-check/route.ts` | POST |
| `/api/models/time-decay/:truthId` | `models/time-decay/[truthId]/route.ts` | GET |
| `/api/models/batch-decay` | `models/batch-decay/route.ts` | POST |
| `/api/models/pattern-detect` | `models/pattern-detect/route.ts` | POST |
| `/api/models/predictive-outage` | `models/predictive-outage/route.ts` | POST |
| `/api/auth/agency/register` | `auth/agency/register/route.ts` | POST |
| `/api/auth/agency/login` | `auth/agency/login/route.ts` | POST |
| `/api/auth/logout` | `auth/logout/route.ts` | POST |
| `/api/auth/me` | `auth/me/route.ts` | GET |
| `/api/account/settings` | `account/settings/route.ts` | PATCH |
| `/api/organizations` | `organizations/route.ts` | GET, POST |
| `/api/organizations/:id` | `organizations/[id]/route.ts` | GET |
| `/api/organizations/me/truths` | `organizations/me/truths/route.ts` | POST |

## New Dashboard Routes

| Route | Next.js File | Method(s) | Purpose |
|---|---|---|---|
| `/api/admin/stats` | `admin/stats/route.ts` | GET | Platform-wide stats (users, orgs, truths, rewards) — admin-only |
| `/api/admin/users` | `admin/users/route.ts` | GET | List all platform users — admin-only |
| `/api/admin/users/:id` | `admin/users/[id]/route.ts` | PATCH | Update user role/status — admin-only |
| `/api/org/members` | `org/members/route.ts` | GET, POST | List / invite org members |
| `/api/org/members/:id` | `org/members/[id]/route.ts` | PATCH, DELETE | Update / remove member |
| `/api/org/vacancies` | `org/vacancies/route.ts` | GET, POST | List / create vacancies |
| `/api/org/vacancies/:id` | `org/vacancies/[id]/route.ts` | PATCH, DELETE | Update / delete vacancy |
| `/api/org/vacancies/:id/applications` | `org/vacancies/[id]/applications/route.ts` | GET, POST | List / submit applications |
| `/api/user/profile` | `user/profile/route.ts` | GET | Current user profile (auto-creates platform_users row) |
| `/api/webhook/clerk` | `webhook/clerk/route.ts` | POST | Clerk webhook — svix signature verification, upserts platform_users |

## Conventions Applied

1. **Neon SQL client**: Every handler calls `await ensureDbInitialized()` at the start, then uses the `getDb()` tagged-template client via `@/lib/neon-storage`.
2. **Clerk auth**: `getUserId()` (async, via `await auth()`) replaces the old `getUserIdentity`/`X-Visitor-Id` flow; the Clerk user ID is hashed to a `dev_XXXX` userHash. `getClerkUserId()` is used for routes that need the raw Clerk identity.
3. **Agency auth** (`requireAgencyAuth` in Express): replaced by Clerk `auth()` — routes look up `agency_accounts.clerk_user_id` to resolve the organization. The `organizations/me/truths` endpoint takes `organizationId` from the authenticated account, never the request body.
4. **Admin / org routes**: gated on the caller's `platform_users.is_admin` (admin) or `platform_users.organization_id` (org) — both populated by the Clerk webhook.
5. **Next.js 15 params**: all dynamic route handlers use `params: Promise<{...}>` and `await params`.
6. **Clerk webhook**: verified with `svix` (`Webhook.verify`); handles `user.created`, `user.updated`, `user.deleted`.
7. **Validation**: Zod schemas (reused from `@shared/schema`) via the shared `validate` / `validationErrorResponse` helpers.
8. **Errors**: original HTTP status codes and messages preserved (404 not found, 403 own-truth/self-verify, 409 duplicate verify, 400 insufficient balance, etc.).

## File Counts
- Route handler files: **55**
- Shared lib files: **2** (`api-helpers.ts`, `neon-storage.ts`)
- Total new TypeScript files: **57**

## Type Checking
All new files pass `tsc --noEmit` with zero errors. (Pre-existing errors in unrelated frontend files — missing radix/optional packages and stale hook imports — are out of scope for this port.)
