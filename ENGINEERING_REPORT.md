# 9JATRUTH — Complete Engineering Implementation Report

**Date:** September 13, 2026  
**Repository:** [github.com/Vinnnnce/9jatruth](https://github.com/Vinnnnce/9jatruth)  
**Deployed App:** Next.js on Vercel (Clerk auth + Neon PostgreSQL)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Part 1 — Super Admin Dashboard Fixes & Upgrades](#part-1)
3. [Part 2 — Database & Data Flow Fixes](#part-2)
4. [Part 3 — News System Fixes](#part-3)
5. [Part 4 — Media & Profile Fixes](#part-4)
6. [Part 5 — Account Settings Upgrade](#part-5)
7. [Part 6 — Compare Feature Fix](#part-6)
8. [Database Migration Scripts](#migrations)
9. [Testing Plan](#testing)
10. [Final Verification Checklist](#checklist)
11. [Deployment Instructions](#deployment)

---

## Architecture Overview

The 9jatruth platform consists of three components:

| Component | Tech Stack | Purpose |
|-----------|-----------|---------|
| **Frontend** (deployed) | Next.js 15 + Clerk + Tailwind | Main user-facing app, deployed on Vercel |
| **Admin Panel** (separate) | Vite + React + MUI + Redux | Separate admin dashboard (not deployed on Vercel) |
| **Backend** (scaffold) | NestJS + Prisma + JWT | API scaffold (not the deployed backend) |

**Critical Finding:** The Next.js app IS the deployed backend. It uses:
- **Auth:** Clerk (super admin = `9jatruthofficial@gmail.com` verified email)
- **Database:** Neon PostgreSQL via `@neondatabase/serverless` raw SQL
- **Schema:** Initialized dynamically via `ensureDbInitialized()` in `src/lib/db.ts`
- **API:** Next.js Route Handlers at `src/app/api/`

The NestJS backend is a separate scaffold that is NOT deployed. All fixes target the Next.js app.

---

## Part 1: Super Admin Dashboard Fixes & Upgrades

### A. Super Admin Dashboard Login Error

**Root Cause Analysis:**

1. **Launch gate expired:** The middleware had a launch gate set for August 21, 2026. Since we're past that date, the gate is disabled — this is NOT the issue.

2. **Clerk configuration:** The middleware checks if `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is configured. If it contains "placeholder" or is < 20 chars, Clerk is treated as unconfigured and the middleware falls back to pass-through (no auth protection). The super admin check in API routes then falls back to `SUPER_ADMIN_EMAIL` env var.

3. **Admin route protection:** The middleware protects `/admin(.*)` routes with `auth.protect()` ONLY when Clerk is configured. If Clerk isn't configured, admin pages are accessible without auth — but API routes still check `isSuperAdmin()`.

4. **Super admin check:** The `isSuperAdmin()` function in `src/lib/admin-auth.ts` checks if the current Clerk user has a verified email matching `SUPER_ADMIN_EMAIL` (default: `9jatruthofficial@gmail.com`). It matches ANY verified email on the Clerk account.

**Fix Applied:**

The middleware and admin auth are correctly implemented. The "login error" is caused by one of:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` not set or set to "placeholder" in Vercel env vars
- `CLERK_SECRET_KEY` not set in Vercel env vars
- The super admin email not being verified in Clerk

**Solution:** Set these environment variables in Vercel:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_XXXX
CLERK_SECRET_KEY=sk_live_XXXX
SUPER_ADMIN_EMAIL=9jatruthofficial@gmail.com
```

No code changes needed — the middleware and auth logic are correct.

### B. Accept/Decline Organisation Requests

**Root Cause:** The existing `/api/admin/organizations/[id]/verify` route handles approve/reject, but the user requested explicit `/admin/organisations/{id}/accept` and `/admin/organisations/{id}/decline` endpoints.

**Files Created:**

1. **`src/app/api/admin/organisations/[id]/accept/route.ts`** — POST endpoint that:
   - Sets `verification_status = 'accepted'`, `verified = 1`
   - Stamps `verification_badge`, `verified_at`, `verified_by`
   - Logs to `audit_log` table

2. **`src/app/api/admin/organisations/[id]/decline/route.ts`** — POST endpoint that:
   - Sets `verification_status = 'declined'`, `verified = 0`
   - Records decline reason in `verification_notes`
   - Logs to `audit_log` table

3. **`src/app/api/admin/audit-log/route.ts`** — GET endpoint for viewing audit log entries with pagination and filtering.

**Schema Changes:** Added `verification_status` column to `organizations` table (see migration script).

### C. Delete, Block, Suspend, Restore User Accounts

**Root Cause:** The existing `/api/admin/users/[id]` route only supports PATCH for role updates. No block/suspend/restore/delete actions existed.

**File Created:**

**`src/app/api/admin/users/[id]/status/route.ts`** — POST endpoint that:
- **DELETE:** Hard deletes the user from `platform_users` + deletes from Clerk
- **BLOCK:** Sets `status = 'blocked'`, bans user in Clerk
- **SUSPEND:** Sets `status = 'suspended'` + optional `suspended_until` date, bans in Clerk
- **RESTORE:** Sets `status = 'active'`, unbans in Clerk

**Clerk Sync:** Uses `clerkClient` to ban/unban/delete users in Clerk, keeping DB and Clerk state in sync. Non-fatal if Clerk sync fails — DB is source of truth.

**Schema Changes:** Added `status`, `suspended_until`, `deleted_at` columns to `platform_users` table.

**Admin UI Controls:** The admin dashboard page (`src/app/(dashboard)/admin/page.tsx`) already has a users table. Action buttons should be added in the users table rows (see UI section below).

---

## Part 2: Database & Data Flow Fixes

### D. Political Data Not Fetching

**Root Cause Analysis:**

1. **Database connection:** The `getDb()` function in `src/lib/db.ts` uses `process.env.DATABASE_URL` to connect to Neon. If this points to an OLD database, political tables may be empty or missing.

2. **Table initialization:** The `ensureDbInitialized()` function creates tables on first access. Political tables (`political_parties`, `political_candidates`, `office_holders`, `political_persons`, `political_positions`) are created during initialization.

3. **Silent failures:** The political API routes had minimal error logging, making it hard to diagnose issues.

**Fixes Applied:**

1. **Added error logging** to all political endpoints:
   - `src/app/api/politics/parties/route.ts` — Added `console.log` for row count, `try/catch` with error message in response
   - `src/app/api/politics/office-holders/route.ts` — Added `console.log` for row count, `try/catch` with error details
   - `src/app/api/politics/candidates/route.ts` — Added `console.log` for row count and total, `try/catch` with error details

2. **Graceful degradation:** All endpoints now return empty arrays with error info on failure (instead of crashing).

**Solution for production:**
- Verify `DATABASE_URL` in Vercel env vars points to the NEW Neon database
- Run the migration script to create all political tables
- Check Vercel function logs for `[politics/*]` messages

### E. Neon Database Migration

**Files Created:**

1. **`migrations/001_schema_upgrade.sql`** — SQL migration that creates:
   - `audit_log` table
   - `platform_users.status`, `suspended_until`, `deleted_at` columns
   - `organizations.verification_status`, `verification_badge`, `verified_at`, `verified_by`, `verification_notes` columns
   - `news_external` table (if not exists)
   - Political data improvements (AI summary columns)
   - Compare feature indexes
   - Schema version update

2. **`migrations/migrate-data.js`** — Node.js script that:
   - Connects to both OLD and NEW Neon databases
   - Copies all tables in dependency order
   - Validates row counts
   - Validates foreign key integrity
   - Usage: `OLD_DATABASE_URL=... NEW_DATABASE_URL=... node migrations/migrate-data.js`

---

## Part 3: News System Fixes

### F. External News API Fetch

**Root Cause:** The news fetching system already exists and is functional:
- `src/lib/news-external.ts` — Fetches from NewsAPI.org, stores in `news_external` table
- `src/app/api/news/fetch-external/route.ts` — Cron-triggered endpoint
- `src/app/api/news/external/route.ts` — Lists external news with pagination

**Issue:** `NEWS_API_KEY` environment variable not set or set to "your-newsapi-key" in Vercel.

**Solution:** Set `NEWS_API_KEY` in Vercel env vars to a valid NewsAPI.org API key.

### G. External News in Feeds

**File Created:**

**`src/app/api/feeds/news/route.ts`** — GET endpoint that:
- Returns external news articles from `news_external` table
- Supports pagination (`limit`, `offset`)
- Supports category and search filtering
- Returns `hasMore` flag for infinite scroll
- Graceful error handling (returns empty array on failure)

**Frontend:** The `NewsFeed` component (`src/components/news-feed.tsx`) already fetches from `/api/news/feed` which merges internal + external news. The feeds page imports and renders this component.

### H. Remove AI News Summary from Feeds

**Fix Applied:**

1. **Removed `BatchAISummaries` import** from `src/components/news-feed.tsx`
2. **Removed the AI Batch Summaries section** that rendered below the news cards
3. **Added error state** with retry button for failed news loads
4. **Added loading state** with skeleton loaders

The feeds page now displays only raw news content without AI-generated summaries.

---

## Part 4: Media & Profile Fixes

### I. Audio Post Feature

**Root Cause Analysis:**

The media upload route (`src/app/api/media/upload/route.ts`) already supports audio files:
- Allowed audio MIME types: `audio/webm`, `audio/mp3`, `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/aac`, `audio/mp4`
- Max audio size: 25MB
- Audio files are stored as data URLs (base64) for Vercel compatibility

**Fix Applied:** Fixed file extension detection for audio files — previously defaulted to `.mp4` for non-image/non-video files. Now correctly uses `.webm` for audio.

**Audio playback:** Audio posts appear in feeds as part of the `mediaUrls` JSONB array on `micro_truths`. The truth post card component should render `<audio>` elements for audio media types.

### J. Profile Photo Upload

**Root Cause Analysis:**

The profile photo upload is already functional in `src/app/(dashboard)/user/page.tsx`:
- Uses `fileInputRef` to trigger file picker
- Validates file type (image/*) and size (10MB)
- Uploads to `/api/media/upload`
- Updates profile via `updateMutation`
- Shows success/error toast

**Fix Applied:** Added Clerk avatar sync to the profile update route (`src/app/api/user/profile/route.ts`). When `avatarUrl` is updated:
- Checks if Clerk is configured
- Uses `clerkClient.users.updateUserProfileImage()` to sync the avatar to Clerk
- Non-fatal if Clerk sync fails — DB update still succeeds

---

## Part 5: Account Settings Upgrade

**File Created:**

**`src/app/(dashboard)/advanced-settings/page.tsx`** — Complete redesign with 5 sections:

1. **Personal Info** — Name, email, phone, bio, occupation, website, social links, gender
2. **Security** — Password change, 2FA toggle, active sessions
3. **Notifications** — Push, email, political alerts, security alerts, feed updates, weekly digest
4. **Connected Accounts** — Google, X (Twitter), LinkedIn connection status
5. **Privacy** — Profile visibility, email/phone visibility, data sharing, account deletion

**Responsive Design:**
- Mobile-first layout with grid that expands on desktop
- Tab navigation with icons (hidden labels on mobile, visible on desktop)
- Form fields in 2-column grid on desktop, 1-column on mobile
- All forms have validation, success messages, and error handling

---

## Part 6: Compare Feature Fix

**File Created:**

**`src/app/api/compare/enhanced/route.ts`** — Enhanced comparison API that:

1. **Supports 4 entity types:**
   - `candidate` — Political candidates with party info
   - `office-holder` — Incumbent office holders with position/person/party details
   - `party` — Political parties with candidate/holder counts
   - `geo` — States with candidate/holder/LGA counts

2. **AI-driven comparison** (when AI is configured):
   - Key differences between entities
   - Strengths per entity
   - Weaknesses per entity
   - Neutral insights
   - Confidence score
   - System prompt enforces neutral, factual, non-political, non-persuasive output

3. **Graceful degradation:** Returns raw entity data with fallback comparison when AI is not configured.

4. **Rate limited:** 20 requests per minute per IP.

---

## Database Migration Scripts

### Migration 1: Schema Upgrade

**File:** `migrations/001_schema_upgrade.sql`

Run against the NEW Neon database:
```bash
psql $NEW_DATABASE_URL -f migrations/001_schema_upgrade.sql
```

Or via Neon's SQL editor (paste the SQL content).

### Migration 2: Data Migration

**File:** `migrations/migrate-data.js`

```bash
OLD_DATABASE_URL="postgresql://old-neon-connection-string" \
NEW_DATABASE_URL="postgresql://new-neon-connection-string" \
node migrations/migrate-data.js
```

---

## Testing Plan

### Part 1 — Super Admin Dashboard

| Test | Description | Expected Result |
|------|-------------|-----------------|
| 1.1 | Set Clerk env vars, visit /admin | Dashboard loads |
| 1.2 | Login as non-admin, visit /admin | Redirected to /sign-in |
| 1.3 | POST /api/admin/organisations/1/accept | Org status → accepted, audit log created |
| 1.4 | POST /api/admin/organisations/1/decline | Org status → declined, audit log created |
| 1.5 | POST /api/admin/users/1/status {action: "block"} | User status → blocked, Clerk user banned |
| 1.6 | POST /api/admin/users/1/status {action: "suspend"} | User status → suspended |
| 1.7 | POST /api/admin/users/1/status {action: "restore"} | User status → active, Clerk user unbanned |
| 1.8 | POST /api/admin/users/1/status {action: "delete"} | User deleted from DB + Clerk |
| 1.9 | GET /api/admin/audit-log | Returns paginated audit entries |

### Part 2 — Political Data

| Test | Description | Expected Result |
|------|-------------|-----------------|
| 2.1 | GET /api/politics/parties | Returns parties array, logs row count |
| 2.2 | GET /api/politics/candidates | Returns candidates with party info |
| 2.3 | GET /api/politics/office-holders | Returns office holders with person/position |
| 2.4 | Check Vercel logs for [politics/*] | See row count logs |

### Part 3 — News System

| Test | Description | Expected Result |
|------|-------------|-----------------|
| 3.1 | POST /api/news/fetch-external (with cron secret) | Fetches and stores news from NewsAPI |
| 3.2 | GET /api/news/external | Returns external news articles |
| 3.3 | GET /api/feeds/news | Returns external news for feeds |
| 3.4 | Visit /feeds page | News cards visible, no AI summary section |
| 3.5 | Test error state | Retry button appears on fetch failure |

### Part 4 — Media & Profile

| Test | Description | Expected Result |
|------|-------------|-----------------|
| 4.1 | Upload audio file via /api/media/upload | Returns URL with fileType: "audio" |
| 4.2 | Upload profile photo | Photo appears, Clerk avatar synced |
| 4.3 | Check audio playback in feeds | Audio player renders correctly |

### Part 5 — Account Settings

| Test | Description | Expected Result |
|------|-------------|-----------------|
| 5.1 | Visit /advanced-settings on mobile | Responsive layout, tab navigation |
| 5.2 | Visit /advanced-settings on desktop | 2-column grid layout |
| 5.3 | Update personal info | Success toast, data saved |
| 5.4 | Change password | Validation works, password updated |
| 5.5 | Toggle notification prefs | Switches save state |
| 5.6 | Toggle privacy settings | Switches save state |

### Part 6 — Compare Feature

| Test | Description | Expected Result |
|------|-------------|-----------------|
| 6.1 | GET /api/compare/enhanced?type=candidate&ids=1,2 | Returns candidates + AI comparison |
| 6.2 | GET /api/compare/enhanced?type=office-holder&ids=1,2 | Returns office holders + AI comparison |
| 6.3 | GET /api/compare/enhanced?type=party&ids=1,2 | Returns parties + AI comparison |
| 6.4 | GET /api/compare/enhanced?type=geo&ids=1,2 | Returns geo data + AI comparison |
| 6.5 | Verify AI output is neutral | No political bias, factual only |

---

## Final Verification Checklist

- [ ] Clerk env vars set in Vercel (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- [ ] `DATABASE_URL` points to NEW Neon database
- [ ] `NEWS_API_KEY` set to valid NewsAPI.org key
- [ ] Migration SQL applied to Neon database
- [ ] Super admin can access /admin dashboard
- [ ] Org accept/decline endpoints work + audit logged
- [ ] User block/suspend/restore/delete endpoints work + Clerk synced
- [ ] Political data endpoints return data with logging
- [ ] External news fetches from NewsAPI and displays
- [ ] Feeds page shows news without AI summary
- [ ] Audio uploads work and display in feeds
- [ ] Profile photo uploads + Clerk avatar sync
- [ ] Advanced account settings page renders responsively
- [ ] Compare feature returns AI-driven neutral comparison
- [ ] All API routes have error handling
- [ ] No TypeScript build errors

---

## Deployment Instructions

### 1. Push to GitHub

```bash
cd /path/to/9jatruth
git add -A
git commit -m "feat: comprehensive platform fixes & upgrades

- Add org accept/decline endpoints with audit logging
- Add user block/suspend/restore/delete with Clerk sync
- Fix political data endpoints with error logging
- Add /feeds/news endpoint
- Remove AI news summary from feeds
- Fix audio upload file extension
- Add Clerk avatar sync for profile photos
- Create advanced account settings page (responsive)
- Add enhanced compare API with AI-driven comparison
- Add database migration scripts for Neon
- Add audit_log table and user status fields"
git push origin main
```

### 2. Apply Neon Database Migration

**Option A — Neon SQL Editor:**
1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Open the SQL Editor
4. Paste the contents of `migrations/001_schema_upgrade.sql`
5. Click Run

**Option B — psql:**
```bash
psql "postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require" \
  -f migrations/001_schema_upgrade.sql
```

### 3. Migrate Data (if needed)

```bash
OLD_DATABASE_URL="postgresql://old-neon-connection-string" \
NEW_DATABASE_URL="postgresql://new-neon-connection-string" \
node migrations/migrate-data.js
```

### 4. Set Vercel Environment Variables

In the [Vercel dashboard](https://vercel.com/dashboard):
1. Select your 9jatruth project
2. Go to Settings → Environment Variables
3. Ensure these are set:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | New Neon connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key |
| `CLERK_SECRET_KEY` | Your Clerk secret key |
| `SUPER_ADMIN_EMAIL` | `9jatruthofficial@gmail.com` |
| `NEWS_API_KEY` | Your NewsAPI.org API key |
| `CRON_SECRET` | A random secret for cron endpoints |

### 5. Deploy to Vercel

**Automatic (on push to main):**
```bash
git push origin main
```
Vercel will automatically build and deploy.

**Manual:**
```bash
npm install -g vercel
vercel --prod
```

### 6. Verify Deployment

1. Visit your Vercel deployment URL
2. Test the super admin dashboard at `/admin`
3. Test API endpoints:
   - `GET /api/politics/parties`
   - `GET /api/feeds/news`
   - `GET /api/compare/enhanced?type=candidate&ids=1,2`
4. Check Vercel function logs for `[politics/*]` messages

---

## Files Modified/Created Summary

### New Files Created

| File | Purpose |
|------|---------|
| `src/app/api/admin/users/[id]/status/route.ts` | User block/suspend/restore/delete |
| `src/app/api/admin/organisations/[id]/accept/route.ts` | Accept org request |
| `src/app/api/admin/organisations/[id]/decline/route.ts` | Decline org request |
| `src/app/api/admin/audit-log/route.ts` | View audit log |
| `src/app/api/feeds/news/route.ts` | External news for feeds |
| `src/app/api/compare/enhanced/route.ts` | Enhanced compare with AI |
| `src/app/(dashboard)/advanced-settings/page.tsx` | Advanced account settings |
| `migrations/001_schema_upgrade.sql` | Database schema migration |
| `migrations/migrate-data.js` | Data migration script |

### Files Modified

| File | Change |
|------|--------|
| `src/app/api/politics/parties/route.ts` | Added logging + error handling |
| `src/app/api/politics/office-holders/route.ts` | Added logging + error handling |
| `src/app/api/politics/candidates/route.ts` | Added logging + error handling |
| `src/components/news-feed.tsx` | Removed AI summaries, added error/loading states |
| `src/app/api/media/upload/route.ts` | Fixed audio file extension |
| `src/app/api/user/profile/route.ts` | Added Clerk avatar sync |

---

## Note on GitHub Push / Neon Sync / Vercel Deploy

I was unable to push to GitHub, sync to Neon, or deploy to Vercel because:
1. **GitHub:** No write access to the `Vinnnnce/9jatruth` repository (no credentials provided)
2. **Neon:** No database credentials provided
3. **Vercel:** No deployment credentials provided

All code changes have been written to the cloned repository locally. To deploy:
1. Push the code to GitHub manually (instructions above)
2. Apply the migration SQL to Neon (instructions above)
3. Vercel will auto-deploy on push, or deploy manually (instructions above)
