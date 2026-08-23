# 9jatruth Platform Upgrade — Implementation Guide

This documents the upgrade applied to the `9jatruth` (Vinnnnce/9jatruth) codebase: location-based feeds, an advanced politics system, AI-driven capabilities, the fixed referral + rewards sync, the responsive super-admin dashboard with live Site/Feature/Rewards config, the hardened news publication flow, and the AI-powered compare feature.

**Stack:** Next.js 15 (App Router) · Neon PostgreSQL (serverless) · Drizzle/Prisma · Clerk auth · shadcn/ui + Tailwind · Deepseek + Kimi K3 AI · Vercel.

**Status:** all new/changed TypeScript compiles with `npx tsc --noEmit` → **0 errors**.

---

## 1. Database schema

The app auto-creates tables idempotently on first request via `ensureDbInitialized()` in `src/lib/db.ts`. Schema changes are gated by `SCHEMA_VERSION` (now `2026-08-23-v4`); bumping it re-runs the additive DDL in a single `sql.transaction(...)` round-trip, so a cold start applies the new tables/columns once and then skips on subsequent boots.

### New tables

```sql
-- Super-admin controlled site branding/config (singleton row id=1)
CREATE TABLE IF NOT EXISTS site_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  primary_color TEXT NOT NULL DEFAULT '#0f766e',
  secondary_color TEXT NOT NULL DEFAULT '#f59e0b',
  logo_url TEXT,
  homepage_banner_text TEXT,
  announcement_bar JSONB NOT NULL DEFAULT '{"active":false,"text":"","type":"info"}',
  referral_base_url TEXT NOT NULL DEFAULT 'https://9jatruth.com',
  default_rewards_config_id INTEGER,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT site_config_singleton CHECK (id = 1)
);

-- Feature flags (singleton row id=1)
CREATE TABLE IF NOT EXISTS feature_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  news_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rewards_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  politics_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  questionnaire_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_compare_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT feature_config_singleton CHECK (id = 1)
);

-- Versioned rewards configs (only one row is_active=TRUE at a time)
CREATE TABLE IF NOT EXISTS rewards_config (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  config JSONB NOT NULL DEFAULT '{}',   -- { truthSubmission, corroboration, aiVerified, dailyStreak, disputedPenalty, referralSignup, referralCompletion, ... }
  updated_by TEXT, updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cache-invalidation event log (audit trail + cross-instance bust signal)
CREATE TABLE IF NOT EXISTS config_events (
  id SERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,             -- rewards.config.updated | site.config.updated | feature.config.updated
  payload JSONB, emitted_by TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Failed news publish attempts (auditability for the publication workflow)
CREATE TABLE IF NOT EXISTS news_publish_errors (
  id SERIAL PRIMARY KEY,
  article_id INTEGER, agency_id INTEGER, title TEXT, category TEXT,
  error_code TEXT NOT NULL,            -- VALIDATION_FAILED | CSRF_FAILED | AGENCY_NOT_OWNED | AGENCY_NOT_VERIFIED
  error_message TEXT NOT NULL, payload JSONB, attempted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versioned AI candidate profiles
CREATE TABLE IF NOT EXISTS candidate_ai_profiles (
  id SERIAL PRIMARY KEY, candidate_id INTEGER NOT NULL,
  summary TEXT, key_strengths JSONB, key_concerns JSONB, stance_themes JSONB,
  confidence INTEGER DEFAULT 0, model_name TEXT, generated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versioned AI manifesto analyses
CREATE TABLE IF NOT EXISTS manifesto_analyses (
  id SERIAL PRIMARY KEY, candidate_id INTEGER NOT NULL,
  key_promises JSONB, themes JSONB, feasibility_notes TEXT, summary TEXT,
  confidence INTEGER DEFAULT 0, model_name TEXT, generated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New columns

```sql
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- user location storage (lat, lng, ward, LGA, state) — note platform_users
-- already had preferred_lat/preferred_lng/preferred_*_name columns; these are
-- the canonical lat/lng/ward/lga/state used by the location feed.
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS ward TEXT;
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS user_lga TEXT;
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS user_state TEXT;
ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ;
```

> The existing `political_candidates` table already holds the full candidate metadata requested (name, photo, autobiography, education_background, previous_political_positions, political_background, businesses, health_status, party_acronym, ward, lga, state, manifesto, term_start, term_end, record_type, election_year, ai_summary, manifesto_summary, ai_comparison, etc.) plus GIN full-text search. Geography (6 geopolitical regions, 36 states + FCT, LGAs) is already seeded.

### Seed defaults
On init, singleton rows are seeded: `site_config (id=1)` with `referral_base_url` from `NEXT_PUBLIC_REFERRAL_BASE_URL`, `feature_config (id=1)` all-on, and an active `rewards_config` named "Default rewards".

---

## 2. API specification

All routes follow the established patterns: `await ensureDbInitialized()` → `const sql = getDb()` (Neon tagged template) → Zod validation → `getClerkUserId()` / `requireSuperAdmin()` → `csrfCheck()` on mutations → `Response.json()`.

### Config & rewards (referral/rewards sync)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/config` | public | Live site + feature config for the frontend `SiteConfigBridge` (colors, announcement bar, logo, feature flags). |
| GET | `/api/rewards/config` | public | Active rewards config (read by the rewards UI). Cache-busted on `rewards.config.updated`. |
| GET | `/api/admin/rewards/config` | super-admin | Active config + list of all configs. |
| POST | `/api/admin/rewards/config/update` | super-admin | Upsert + activate a rewards config. Body: `{ name, config: {...}, activate?: true }`. Emits `rewards.config.updated`. |
| GET | `/api/admin/site-config` | super-admin | Read site config. |
| POST | `/api/admin/site-config/update` | super-admin | Update primary/secondary color, logo_url, homepage_banner_text, announcement_bar, referral_base_url, default_rewards_config_id. Emits `site.config.updated`. |
| GET | `/api/admin/feature-config` | super-admin | Read feature flags. |
| POST | `/api/admin/feature-config/update` | super-admin | Toggle `news_enabled`, `rewards_enabled`, `politics_enabled`, `questionnaire_enabled`, `ai_compare_enabled`. Emits `feature.config.updated`. |

### News publication flow

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/news/publish` | verified agency | Validates title/body/category/agency_id/media; only **verified** agencies publish; inserts as `draft` or `pending_review`. Failures logged to `news_publish_errors`. |
| GET | `/api/news/errors?agency_id=&code=&limit=&offset=` | super-admin | Lists failed publish attempts. |
| GET | `/api/news/by-agency?agency_id=&status=&limit=&offset=` | public | Articles by agency (organization). |

Status workflow: `draft → pending_review → published → rejected` (existing `news_articles.status` column; new `rejection_reason`/`reviewed_by`/`reviewed_at`). Super-admins move items along via the existing `/api/admin/news/[id]` route.

### Location-based feeds

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/feeds/nearby?lat=&lng=&radius_km=&ward=&lga=&state=&category=&limit=&offset=` | public | Posts nearest to the caller via Haversine distance on `micro_truths.report_lat/report_lng` (falls back to neighborhood centroid). Filters by ward (community), LGA, state, category. Ordered by distance. |
| GET/PUT | `/api/user/location` | user | Already present — stores preferred lat/lng/state/LGA/community/region. |

### Politics (aliases + AI)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/politicians?state_id=&position=&lga=&ward=&party=&search=&limit=&offset=` | public | All politicians (incumbents + candidates + aspirants). `position` normalizes president/vice_president/governor/senate/house_of_rep/lga_chairman/councillor. |
| GET | `/api/candidates/2027?state_id=&position=&party=&search=&limit=&offset=` | public | 2027 election candidates (`election_year=2027`, `record_type=candidate`). |
| GET | `/api/office-holders/current?state_id=&position=&limit=&offset=` | public | Current office holders (`record_type=incumbent`), with `term_start`/`term_end`. |
| GET | `/api/politics/candidates?...` | public | Existing full-filter list (unchanged). |
| POST | `/api/politics/candidates/ai-profile` | super-admin | AI candidate profiler — neutral summary, strengths, concerns, themes. Persists to `candidate_ai_profiles` + `political_candidates.ai_summary`. Body: `{ candidate_id }`. |
| POST | `/api/politics/manifesto-analyze` | super-admin | AI manifesto analyzer — key promises, themes, feasibility notes. Persists to `manifesto_analyses` + `political_candidates.manifesto_summary`. Body: `{ candidate_id }`. |

### Compare (generic + AI)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/compare?type=candidate\|neighborhood\|agency&ids=1,2,3` | public | Fetches raw data for 2–4 entities and returns an AI neutral structured comparison: `summary`, `key_differences`, `strengths`, `weaknesses`, `highlights`, `confidence`. (Existing `POST /api/compare/ai` neighborhood comparison is retained.) |

---

## 3. Example queries

```bash
# Nearby feed — posts within 5km of Ikeja
curl "https://9jatruth.com/api/feeds/nearby?lat=6.5833&lng=3.3436&radius_km=5&state=Lagos"

# 2027 governorship candidates in Lagos (state_id from /api/geo/hierarchy)
curl "https://9jatruth.com/api/candidates/2027?state_id=25&position=governor"

# Current senators
curl "https://9jatruth.com/api/office-holders/current?position=senate"

# Compare two candidates with AI summary
curl "https://9jatruth.com/api/compare?type=candidate&ids=12,18"

# Live public config (colors, banner, feature flags)
curl "https://9jatruth.com/api/config"
```

### Raw SQL (Neon)

```sql
-- Active rewards config
SELECT * FROM rewards_config WHERE is_active = TRUE;

-- Recent failed news publish attempts
SELECT * FROM news_publish_errors ORDER BY created_at DESC LIMIT 20;

-- Incumbent governors with terms
SELECT name, state, party_acronym, term_start, term_end
FROM political_candidates WHERE record_type = 'incumbent' AND office = 'governor';

-- Posts within ~5km of a point (Haversine), verified only
SELECT id, category, content, trust_score,
  (6371 * acos(cos(radians(6.5833)) * cos(radians(coalesce(report_lat, 0)))
   * cos(radians(coalesce(report_lng, 0)) - radians(3.3436))
   + sin(radians(6.5833)) * sin(radians(coalesce(report_lat, 0))))) AS distance_km
FROM micro_truths
WHERE status = 'verified' AND report_lat IS NOT NULL
ORDER BY distance_km ASC LIMIT 20;
```

---

## 4. AI model integration plan

The codebase already has `src/lib/ai-providers.ts` with a Deepseek (primary) + Kimi K3 (fallback) ensemble exposing `isAiConfigured()`, `generateAiText()`, `generateAiJson()`, `generateAiJsonArray()`. All new AI routes use `generateAiJson()` with a strict JSON schema and a typed fallback object, so the UI always has something to render even if AI is down.

| Capability | Endpoint | Model use | Persistence |
|---|---|---|---|
| AI candidate profiler | `POST /api/politics/candidates/ai-profile` | neutral summary, strengths, concerns, themes | `candidate_ai_profiles` + `political_candidates.ai_summary` |
| AI manifesto analyzer | `POST /api/politics/manifesto-analyze` | key promises, themes, feasibility notes | `manifesto_analyses` + `political_candidates.manifesto_summary` |
| AI-powered compare | `GET /api/compare?type=...&ids=...` | key differences, strengths/weaknesses, highlights | returned inline (denormalized `ai_comparison` on candidate already supported) |
| News auto-summary | existing `/api/news/auto-summary` | unchanged | unchanged |

Neutrality & safety: every AI system prompt instructs the model to be strictly neutral, non-partisan, grounded only in supplied data, and to state when data is missing. AI writes are super-admin gated and rate-limited (`rateLimit`). Outputs are stored as versioned rows so audits/reverts are possible.

Env keys (already in `.env.example`): `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`, `KIMI_API_KEY`, `KIMI_MODEL`, `KIMI_BASE_URL`.

---

## 5. Referral & rewards sync (fixed)

- **Base URL** is now resolved most-specific-first in `src/lib/neon-storage.ts → getReferralStats()`:
  1. live `site_config.referral_base_url` (super-admin editable, reflects instantly)
  2. `NEXT_PUBLIC_REFERRAL_BASE_URL` env var
  3. `NEXT_PUBLIC_REFERRAL_DOMAIN` env var (legacy)
  4. `https://9jatruth.com` (canonical default — never the vercel.app preview domain)
- **No hardcoded `9jatruth.vercel.app` URLs remain** in `src/` (verified via grep; the only `vercel.app` reference is a comment).
- **RewardsConfig table** (`rewards_config`) is connected to the rewards module; the active config is read through `src/lib/config.ts → getRewardsConfig()` with a 15s TTL in-memory cache that is **busted immediately** on every `rewards.config.updated` event.
- **Super-admin updates reflect instantly**: `POST /api/admin/rewards/config/update` writes the row, activates it, updates `site_config.default_rewards_config_id`, and emits `rewards.config.updated` → `emitConfigEvent()` busts the cache + persists the event to `config_events` for cross-instance invalidation. The rewards UI reads `/api/rewards/config` (live).
- **Event-based cache invalidation**: `emitConfigEvent(name, payload, emittedBy)` handles `rewards.config.updated`, `site.config.updated`, `feature.config.updated`; each busts its cache slice and logs to `config_events`.

---

## 6. Super-admin dashboard (responsive + live config)

- The dashboard already uses shadcn's collapsible `Sidebar` (`SidebarProvider`/`SidebarTrigger`/`useSidebar`) which fully collapses on desktop and slides over as a drawer on mobile — satisfying the collapsible-sidebar requirement.
- A new **Configuration** tab renders `<AdminConfig />` (`src/components/admin-config.tsx`) with three cards: Site config (colors, logo, banner, announcement bar, referral base URL), Feature flags (live toggles), and Rewards config (edit + activate). Every save invalidates the relevant react-query keys so the UI is immediately consistent.
- A new `SiteConfigBridge` (`src/components/site-config-bridge.tsx`) is mounted in the root layout; it polls `/api/config` every 30s, injects `--primary`/`--secondary` CSS variables (instant theme), renders the announcement bar, swaps the favicon to the configured logo, and publishes feature flags via `window.__9JAFEATURES__` + a `9ja:features` event so any component can hide/show (news, rewards, politics, questionnaire, ai_compare).
- The admin page's `TabsList` is `flex flex-wrap … overflow-x-auto` so tabs scroll horizontally on small screens.

---

## 7. Environment variables

Add/update in `.env`, Vercel project settings, and your local `.env`:

```env
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
NEXT_PUBLIC_APP_URL=https://9jatruth.com
NEXT_PUBLIC_REFERRAL_BASE_URL=https://9jatruth.com   # canonical referral domain (never the vercel.app preview)
# NEXT_PUBLIC_REFERRAL_DOMAIN=9jatruth.com            # optional legacy host-only override
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
SUPER_ADMIN_EMAIL=9jatruthofficial@gmail.com
DEEPSEEK_API_KEY=...        DEEPSEEK_MODEL=deepseek-chat    DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
KIMI_API_KEY=...            KIMI_MODEL=kimi-k3              KIMI_BASE_URL=https://api.moonshot.ai/v1
NEXT_PUBLIC_MAPTILER_API_KEY=...
```

### Clerk allowed domains
In the Clerk dashboard → **Domains / Allowed origins**, add:
- `https://9jatruth.com`
- `https://www.9jatruth.com` (if used)
- any org subdomains like `https://<org>.9jatruth.com`

Set the production URL to `https://9jatruth.com` and keep the Vercel preview domains only for staging. (The `/r/[code]` referral route and org subdomains use `9jatruth.com`.)

---

## 8. Deployment — push to GitHub, sync Neon, deploy to Vercel

### Prereq: schema migration
The new tables/columns are created automatically on the first request after deploy (the `SCHEMA_VERSION` bump triggers `ensureDbInitialized()`). No manual SQL is required, but you can force it by hitting `GET /api/health` once after deploy.

### Option A — you run it (no credentials shared with the agent)
```bash
# 1. From the upgraded workspace, push to a branch
cd 9jatruth
git checkout -b upgrade/location-politics-ai-rewards
git add -A && git commit -m "Upgrade: location feeds, politics 2027, AI, referral/rewards sync, admin config, news, compare"
git push origin upgrade/location-politics-ai-rewards   # open a PR on GitHub

# 2. Neon: the existing DATABASE_URL already points to your Neon project.
#    The new tables are auto-created on first request — no migration script needed.
#    (Optional) verify in Neon's SQL editor:
#    SELECT * FROM site_config; SELECT * FROM rewards_config WHERE is_active;

# 3. Vercel: import the repo (or use the existing project), add all env vars
#    above in Project Settings → Environment Variables, set the production
#    domain to 9jatruth.com, and deploy. Vercel auto-detects Next.js.
```

### Option B — authorize the agent (secure credential flow)
Provide, via the platform's secure credential prompt (do **not** paste raw secrets in chat):
- **GitHub** PAT with `repo` scope (to push the branch + open a PR).
- **Neon** `DATABASE_URL` (or confirm the existing one is correct).
- **Vercel** token + project name (to trigger a production deploy).

The agent will: commit the changes to a branch, push, open a PR, hit `/api/health` to trigger the schema migration on Neon, and deploy to Vercel — each step confirmed with you before any external mutation.

---

## 9. File index (new/changed)

New files:
- `src/lib/config.ts` — cached SiteConfig/FeatureConfig/RewardsConfig + `emitConfigEvent()` cache invalidation.
- `src/lib/politics.ts` — `queryPoliticians()` shared helper + position normalization.
- `src/components/site-config-bridge.tsx` — live theme/banner/feature bridge.
- `src/components/admin-config.tsx` — super-admin config panel.
- `src/app/api/config/route.ts`, `src/app/api/rewards/config/route.ts`
- `src/app/api/admin/site-config/route.ts` + `update/route.ts`
- `src/app/api/admin/feature-config/route.ts` + `update/route.ts`
- `src/app/api/admin/rewards/config/route.ts` (GET + POST update)
- `src/app/api/news/publish/route.ts`, `errors/route.ts`, `by-agency/route.ts`
- `src/app/api/feeds/nearby/route.ts`
- `src/app/api/compare/route.ts` (generic + AI)
- `src/app/api/politicians/route.ts`, `candidates/2027/route.ts`, `office-holders/current/route.ts`
- `src/app/api/politics/candidates/ai-profile/route.ts`, `manifesto-analyze/route.ts`
- `public/wireframes.html`

Changed files:
- `src/lib/db.ts` — `SCHEMA_VERSION` bump + new tables/columns + config seeding.
- `src/lib/neon-storage.ts` — referral base URL now live-config + env driven.
- `src/app/layout.tsx` — mounts `SiteConfigBridge`.
- `src/app/(dashboard)/admin/page.tsx` — adds the Configuration tab.
- `.env.example` — `NEXT_PUBLIC_REFERRAL_BASE_URL` + Clerk domain note.

Wireframes (viewable): the deployed preview shows location feeds, candidate profile, compare, and admin config screens.
