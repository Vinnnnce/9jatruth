# 9jatruth — Nigeria Political Database

## Complete Database Schema, ETL Pipeline, and API Design

---

## 1. Database Overview

The 9jatruth political database is a normalized PostgreSQL schema running on **Neon** (serverless Postgres). It covers Nigeria's complete electoral geography (6 geopolitical zones, 37 states + FCT, 774 LGAs, 8,809 wards), current office holders (President, VP, 36 governors, senators, reps, LGA chairmen, councillors), and 2027 general election candidates.

**Database**: Neon PostgreSQL (project: `cold-sea-44435632`, region: `aws-ap-southeast-1`)
**ORM**: Prisma Client + `@neondatabase/serverless` (raw SQL)
**Schema version**: `2026-08-29-v6`

---

## 2. Geo Hierarchy Tables

### 2.1 `regions` (Geopolitical Zones)

```sql
CREATE TABLE regions (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  code        TEXT,          -- e.g. 'NC', 'SW'
  slug        TEXT,          -- e.g. 'north-central'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Seeded data**: 6 geopolitical zones — North Central (NC), North East (NE), North West (NW), South East (SE), South South (SS), South West (SW).

### 2.2 `states`

```sql
CREATE TABLE states (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  region_id       INTEGER REFERENCES regions(id),
  code            TEXT,          -- INEC code, e.g. '01' for Abia
  portal_id       INTEGER,       -- INEC portal ID
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  source          TEXT,          -- 'INEC'
  source_updated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_states_name ON states(name);
CREATE UNIQUE INDEX idx_states_code ON states(code) WHERE code IS NOT NULL;
```

**Seeded data**: 37 states (36 + FCT), each with INEC code and portal_id.

### 2.3 `lgas`

```sql
CREATE TABLE lgas (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  state_id        INTEGER REFERENCES states(id),
  code            TEXT,          -- INEC LGA code
  portal_id       INTEGER,       -- INEC portal ID
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  source          TEXT,
  source_updated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_lgas_code ON lgas(code);
CREATE INDEX idx_lgas_state ON lgas(state_id);
CREATE UNIQUE INDEX idx_lgas_portal_state ON lgas(portal_id, state_id) WHERE portal_id IS NOT NULL AND state_id IS NOT NULL;
```

**Seeded data**: 774 LGAs, each linked to its state with INEC code and portal_id.

### 2.4 `wards`

```sql
CREATE TABLE wards (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL,
  name            TEXT NOT NULL,
  lga_id          INTEGER NOT NULL REFERENCES lgas(id) ON DELETE CASCADE,
  state_id        INTEGER NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  portal_id       INTEGER,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  source          TEXT,
  source_updated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (lga_id, code, name)
);
CREATE INDEX idx_wards_lga ON wards(lga_id);
CREATE INDEX idx_wards_state ON wards(state_id);
CREATE INDEX idx_wards_code ON wards(code);
```

**Seeded data**: 8,809 wards, each linked to its LGA and state with INEC code and portal_id.

---

## 3. Political Schema Tables

### 3.1 `political_positions`

```sql
CREATE TABLE political_positions (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,     -- 'president', 'governor', etc.
  name        TEXT NOT NULL,             -- 'President', 'State Governor', etc.
  level       TEXT DEFAULT 'federal',   -- 'federal' | 'state' | 'lga'
  sort_order  INTEGER DEFAULT 99,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_political_positions_level ON political_positions(level);
```

**Seeded positions** (9 total):

| Code | Name | Level |
|------|------|-------|
| president | President | federal |
| vice_president | Vice President | federal |
| senator | Senator | federal |
| house_of_rep | House of Representatives Member | federal |
| governor | State Governor | state |
| deputy_governor | Deputy Governor | state |
| state_assembly | State House of Assembly Member | state |
| lga_chairman | LGA Chairman | lga |
| councillor | Ward Councillor | lga |

### 3.2 `political_parties`

```sql
CREATE TABLE political_parties (
  id          SERIAL PRIMARY KEY,
  acronym     TEXT NOT NULL UNIQUE,     -- 'APC', 'PDP', etc.
  name        TEXT NOT NULL,             -- full party name
  color       TEXT,                      -- brand color hex
  logo_url    TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Seeded parties** (18 total): APC, PDP, LP, NNPP, APGA, SDP, ADC, ADP, AAC, NRM, YPP, APP, ZLP, and more.

### 3.3 `political_persons`

```sql
CREATE TABLE political_persons (
  id                          SERIAL PRIMARY KEY,
  slug                        TEXT NOT NULL UNIQUE,     -- URL-safe slug
  full_name                   TEXT NOT NULL,
  photo_url                   TEXT,
  gender                      TEXT,
  date_of_birth               TEXT,
  place_of_birth              TEXT,
  hometown                    TEXT,
  nationality                 TEXT DEFAULT 'Nigerian',
  state_of_origin             TEXT,
  local_govt_of_origin        TEXT,
  autobiography               TEXT,
  education_background        TEXT,
  previous_political_positions TEXT,
  political_background        TEXT,
  businesses                  TEXT,
  business_interests          TEXT,
  net_worth                   TEXT,
  assets_declared             TEXT,
  health_status              TEXT,
  health_disclosure_url       TEXT,
  phone                       TEXT,
  email                       TEXT,
  website                     TEXT,
  facebook                    TEXT,
  twitter                     TEXT,
  instagram                   TEXT,
  linkedin                    TEXT,
  source_urls                 TEXT,
  verification_status         TEXT DEFAULT 'unverified',
  data_confidence             INTEGER DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pp_state_origin ON political_persons(state_of_origin);
CREATE INDEX idx_pp_verification ON political_persons(verification_status);
```

### 3.4 `political_elections`

```sql
CREATE TABLE political_elections (
  id            SERIAL PRIMARY KEY,
  year          INTEGER NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT DEFAULT 'general',
  geo_scope     TEXT DEFAULT 'national',
  election_date DATE,
  status        TEXT DEFAULT 'upcoming',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, type, geo_scope)
);
CREATE INDEX idx_elections_year ON political_elections(year);
```

**Seeded**: 2027 Nigerian General Election (Feb 18, 2027, status: upcoming).

### 3.5 `office_holders` (Current Government)

```sql
CREATE TABLE office_holders (
  id                  SERIAL PRIMARY KEY,
  person_id           INTEGER NOT NULL REFERENCES political_persons(id),
  position_id         INTEGER NOT NULL REFERENCES political_positions(id),
  party_acronym       TEXT,
  election_id         INTEGER REFERENCES political_elections(id),
  state_id            INTEGER REFERENCES states(id),
  lga_id              INTEGER REFERENCES lgas(id),
  ward_id             INTEGER REFERENCES wards(id),
  senatorial_district TEXT,
  federal_constituency TEXT,
  state_constituency  TEXT,
  term_start          TEXT,
  term_end            TEXT,
  incumbent_since      TEXT,
  status              TEXT DEFAULT 'active',
  source_urls         TEXT,
  verification_status TEXT DEFAULT 'unverified',
  data_confidence     INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_oh_position ON office_holders(position_id);
CREATE INDEX idx_oh_geo ON office_holders(state_id, lga_id, ward_id);
CREATE INDEX idx_oh_party ON office_holders(party_acronym);
-- One active federal holder per position (president / VP)
CREATE UNIQUE INDEX idx_office_holders_federal_unique
  ON office_holders(position_id) WHERE status='active' AND state_id IS NULL AND lga_id IS NULL AND ward_id IS NULL;
```

**Seeded data** (38 office holders):
- President: Bola Ahmed Tinubu (APC)
- Vice President: Kashim Shettima (APC)
- 36 State Governors (see seed script for full list)

### 3.6 `election_candidates` (2027 Election Candidates)

```sql
CREATE TABLE election_candidates (
  id                  SERIAL PRIMARY KEY,
  person_id           INTEGER NOT NULL REFERENCES political_persons(id),
  position_id         INTEGER NOT NULL REFERENCES political_positions(id),
  election_id         INTEGER NOT NULL REFERENCES political_elections(id),
  party_acronym       TEXT,
  state_id            INTEGER REFERENCES states(id),
  lga_id              INTEGER REFERENCES lgas(id),
  ward_id             INTEGER REFERENCES wards(id),
  senatorial_district TEXT,
  federal_constituency TEXT,
  state_constituency  TEXT,
  manifesto           TEXT,
  manifesto_summary   TEXT,
  campaign_slogan     TEXT,
  key_policies        TEXT,
  running_mate        TEXT,
  record_type         TEXT DEFAULT 'candidate',
  status              TEXT DEFAULT 'pending',
  source_urls         TEXT,
  verification_status TEXT DEFAULT 'unverified',
  data_confidence     INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ec_party ON election_candidates(party_acronym);
CREATE INDEX idx_ec_position ON election_candidates(position_id);
CREATE INDEX idx_ec_election ON election_candidates(election_id);
CREATE INDEX idx_ec_geo ON election_candidates(state_id, lga_id, ward_id);
```

### 3.7 `political_candidates` (Denormalized Admin View)

A denormalized table used by the admin dashboard for quick CRUD operations. Contains all candidate fields in one row (name, party, bio, education, manifesto, etc.) plus AI analysis columns (`ai_risk_flags`, `ai_summary`, `ai_comparison`).

---

## 4. Community/Content Tables

### 4.1 `micro_truths` (Posts/Feeds)

```sql
CREATE TABLE micro_truths (
  id                 SERIAL PRIMARY KEY,
  neighborhood_id    INTEGER,
  category           TEXT,                -- 'power', 'fuel', 'politics', etc.
  content            TEXT,
  trust_score        INTEGER DEFAULT 50,
  status             TEXT DEFAULT 'pending',
  user_hash          TEXT,
  -- Soft delete (removed from website, retained in database)
  deleted_at         TIMESTAMPTZ,
  deleted_by         TEXT,
  delete_reason      TEXT,
  -- Geo hierarchy FKs
  state_id           INTEGER REFERENCES states(id),
  lga_id             INTEGER REFERENCES lgas(id),
  ward_id            INTEGER REFERENCES wards(id),
  -- AI columns
  ai_tags            TEXT DEFAULT '[]',
  ai_category        TEXT,
  ai_spam_score      FLOAT DEFAULT 0.0,
  trending_score    FLOAT DEFAULT 0.0,
  trending_rank      INTEGER,
  ai_analyzed_at     TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
```

**Soft delete pattern**: Posts are marked with `deleted_at = NOW()` instead of being hard-deleted. All public queries filter `WHERE deleted_at IS NULL`. This prevents FK constraint failures with `feed_likes`, `feed_comments`, `feed_shares`, and `truth_reports` tables.

### 4.2 `organizations`

```sql
CREATE TABLE organizations (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  type         TEXT,
  description  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website      TEXT,
  logo_url     TEXT,
  region       TEXT,
  city         TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  verified     INTEGER DEFAULT 0,    -- 0 = pending, 1 = verified/approved
  active       INTEGER DEFAULT 1,
  admin_hash   TEXT,
  clerk_user_id TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**Verification workflow**: Super admins approve/reject pending organizations via `POST /api/admin/organizations/[id]/verify` with `{ action: "approve" | "reject" }`. Approved orgs get `verified = 1` and a verification badge. The org row is never deleted.

---

## 5. ETL Pipeline

### 5.1 INEC Geography Import

**Script**: `scripts/import-inec-geo.mjs`
**Data source**: `scripts/data/inec-geo/` (from [nigeria-inec-geo](https://github.com/saidiadegoke/nigeria-inec-geo))

**Source data**:
- `states.json` — 37 states with INEC codes and portal IDs
- `lgas.json` — 774 LGAs linked to states
- `wards.json` — 8,809 wards linked to LGAs
- `manifest.json` — Source: `https://cvr.inecnigeria.org/pu`, collected 2026-08-10

**ETL steps**:
1. Ensure geo tables exist (CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS)
2. Upsert 6 geopolitical zones (regions)
3. Upsert 37 states with INEC codes, portal IDs, and zone mapping
4. Batch-upsert 774 LGAs (multi-value INSERTs, 500 per batch)
5. Batch-upsert 8,809 wards (500 per batch, ~18 HTTP calls)
6. Upsert reference data: 9 political positions, 18 parties, 1 election

**Idempotency**: All inserts use `ON CONFLICT DO UPDATE` / `ON CONFLICT DO NOTHING`. Safe to re-run.

**Usage**:
```bash
DATABASE_URL=postgresql://... node scripts/import-inec-geo.mjs              # Full import
DATABASE_URL=... node scripts/import-inec-geo.mjs --state=01                 # One state
DATABASE_URL=... node scripts/import-inec-geo.mjs --reference                # Positions/parties/elections only
```

### 5.2 Office Holders Seed

**Script**: `scripts/seed-office-holders.mjs`

**Seeds**:
- President: Bola Ahmed Tinubu (APC, since 2023-05-29)
- Vice President: Kashim Shettima (APC, since 2023-05-29)
- 36 State Governors (all inaugurated 2023-05-29)

**Idempotency**: Persons upserted by slug. Office holders use `ON CONFLICT DO NOTHING`.

### 5.3 2027 Election Candidates

The `election_candidates` table and API are ready for 2027 candidate data. Official INEC candidate lists for the 2027 general election may not be published yet. When official lists become available, candidates can be imported via:
- INEC official candidate portal
- Party official candidate lists
- The admin dashboard Politics tab (manual entry)

### 5.4 Future Data Sources

For senators, house of reps members, LGA chairmen, and councillors, the schema and API are ready. Data can be imported from:
- INEC official results portal
- National Assembly member directories
- State government websites
- Party official candidate lists (for 2027 election candidates)

---

## 6. API Design

### 6.1 Office Holders

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/politics/office-holders` | GET | List current office holders. Filters: `position`, `state`, `lga`, `ward`, `party`, `zone` |
| `/api/office-holders/current` | GET | Current office holders (alias) |

**Query parameters**:
- `position` — position code (e.g. `president`, `governor`, `senator`)
- `state` — state name or code
- `lga` — LGA name or code
- `ward` — ward name or code
- `party` — party acronym (e.g. `APC`)
- `zone` — geopolitical zone code (e.g. `SW`)

### 6.2 2027 Election Candidates

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/politics/candidates` | GET | List 2027 candidates. Filters: `position`, `state`, `lga`, `ward`, `party`, `year`, `type` |
| `/api/politics/candidates/[id]` | GET | Single candidate detail |
| `/api/politics/candidates/ai-insights` | GET | AI-generated candidate insights |
| `/api/politics/candidates/ai-profile` | GET | AI-generated candidate profile |
| `/api/candidates/2027` | GET | 2027 candidates (alias) |

### 6.3 Political Parties

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/politics/parties` | GET | List all parties (auto-synced from Nigeria2 if empty) |
| `/api/politics/parties/[acronym]` | GET | Party detail + all registered candidates for that party |

**Party detail response**:
```json
{
  "party": { "acronym": "APC", "name": "All Progressives Congress", "color": "#006633" },
  "totalCandidates": 15,
  "candidates": [...],
  "byOffice": {
    "president": [...],
    "governor": [...],
    "senator": [...]
  }
}
```

### 6.4 Geo Hierarchy

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/geo/hierarchy` | GET | Full geo tree (zones → states → LGAs → wards) |
| `/api/geo/wards` | GET | Wards by state/LGA |
| `/api/geo/communities` | GET | Communities by geo |
| `/api/geo/clusters` | GET | Geo clusters |

### 6.5 Posts/Feeds (with soft delete)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/truths` | GET | List posts (filters: category, state, lga, ward) |
| `/api/truths` | POST | Create a post |
| `/api/truths/[id]` | GET | Get single post |
| `/api/truths/[id]` | DELETE | Soft delete (sets `deleted_at`, row retained in DB) |
| `/api/admin/truths` | GET | Admin list (includes soft-deleted) |
| `/api/admin/truths/delete` | DELETE | Bulk soft delete all (admin only) |

### 6.6 Organization Verification

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/organizations` | GET | List organizations |
| `/api/admin/organizations/[id]/verify` | POST | Approve/reject pending org. Body: `{ action: "approve" \| "reject", badge?, notes? }` |

### 6.7 Portfolio (Trends, Leaderboard, Rewards)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trends` | GET | Category trends, time series, top neighborhoods |
| `/api/leaderboard` | GET | Top contributors by submissions, verifications, credits |
| `/api/rewards/balance` | GET | User's reward point balance |
| `/api/rewards/ledger` | GET | Reward transaction history |
| `/api/rewards/redemptions` | GET | Reward redemption requests |

---

## 7. Website Features

### 7.1 Political Party → Registered Candidates
Click any political party on the Politics page to see all its registered candidates, grouped by office (president, governor, senator, etc.).

### 7.2 Soft Delete Posts
Posts are soft-deleted (`deleted_at = NOW()`) — removed from the website but retained in the database for audit. This fixes previous FK constraint errors with `feed_likes`, `feed_comments`, and `feed_shares`.

### 7.3 Portfolio (Trends + Leaderboard + Rewards)
The Portfolio page (`/portfolio`) has four tabs:
- **Overview**: Combined rewards + leaderboard summary
- **Trends**: Category trends, 6-hour time series chart, top neighborhoods
- **Leaderboard**: Top 25 contributors ranked by submissions, verifications, and credits
- **Rewards**: Points balance, progress bar, recent reward activity

### 7.4 Politics Category in Submit Truth
The "Politics" category is available in the submit truth form, with a Landmark icon and violet color.

### 7.5 Super Admin Organization Verification
The Super Admin Dashboard (`/admin`) has an Organizations tab where pending organizations can be approved or rejected. Approving sets `verified = 1` and stamps a verification badge.

### 7.6 Seeded Office Holders
President (Bola Ahmed Tinubu, APC), Vice President (Kashim Shettima, APC), and all 36 state governors are seeded in the database.

---

## 8. Deployment

### 8.1 Neon Database
- Project: `cold-sea-44435632`
- Region: `aws-ap-southeast-1`
- Schema initialized via `ensureDbInitialized()` in `src/lib/db.ts` (idempotent, batches all DDL)
- Schema version: `2026-08-29-v6`

### 8.2 Vercel
- Framework: Next.js 15
- Build command: `npm run build`
- Region: `cle1` (Cleveland)
- API functions: 30s max duration (60s for backup)
- Cron jobs: news auto-summary (10pm), schedule process (11pm), backup (2am), security alerts (6am)

### 8.3 GitHub
- Repository: `github.com/Vinnnnce/9jatruth`
- Branch: `main`

---

## 9. File Structure (Key Files)

```
prisma/schema.prisma              # Full Prisma schema (951 lines)
src/lib/db.ts                     # Neon connection + schema initialization
src/lib/neon-storage.ts           # Post CRUD, soft delete, feed queries
src/lib/categories.ts             # Category config (includes 'politics')
src/lib/api-helpers.ts            # getUserId, getClerkUserId, validation
src/lib/security.ts               # CSRF/same-origin check
src/lib/politics.ts               # queryPoliticians, political data queries
src/app/api/politics/             # Politics API routes
src/app/api/truths/               # Posts API (with soft delete)
src/app/api/admin/organizations/  # Org verification API
src/app/(dashboard)/politics/     # Politics page (party → candidates)
src/app/(dashboard)/portfolio/   # Portfolio page (trends, leaderboard, rewards)
src/app/(dashboard)/submit/      # Submit truth page (with politics category)
src/app/(dashboard)/admin/       # Super admin dashboard (org verification)
scripts/import-inec-geo.mjs       # INEC geography ETL
scripts/seed-office-holders.mjs   # Office holders seed
scripts/data/inec-geo/            # INEC source data (states, LGAs, wards JSON)
```
