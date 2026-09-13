# 9jatruth — Politics Feature Architecture

## Implementation-Ready Specification for Backend, Frontend, and Admin

---

## Table of Contents

1. [Architecture Summary](#1-architecture-summary)
2. [Backend Schema](#2-backend-schema)
3. [API Specification](#3-api-specification)
4. [Frontend / Mobile UI Specs](#4-frontend--mobile-ui-specs)
5. [Admin Dashboard Specs](#5-admin-dashboard-specs)
6. [Data Sources & ETL](#6-data-sources--etl)
7. [Deployment](#7-deployment)

---

## 1. Architecture Summary

### 1.1 System Overview

The 9jatruth Politics feature extends the existing platform with a comprehensive, neutral, and factual electoral data system for Nigeria. It builds on the existing geo-political backbone (states, LGAs, wards) and adds polling units, political parties, election timetables, and an iREV-style result viewing portal.

### 1.2 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React, Tailwind CSS, shadcn/ui |
| Mobile | React Native (shared API contracts) |
| Backend API | Next.js API Routes (Serverless Functions) |
| Database | Neon PostgreSQL (serverless) |
| ORM (runtime) | `@neondatabase/serverless` (raw SQL tagged templates) |
| ORM (schema/migrations) | Prisma Client |
| Deployment | Vercel (Cleveland region `cle1`) |
| Source Control | GitHub (`Vinnnnce/9jatruth`) |

### 1.3 Design Principles

- **Strict Neutrality**: No political persuasion, no predictions, no endorsements. Results are presented as raw factual data.
- **Authoritative Sources**: INEC (inecnigeria.org) and the INEC Geo Data repo (github.com/saidiadegoke/nigeria-inec-geo) are the canonical references.
- **Additive Migrations**: All schema changes are additive (new tables, new columns). No breaking changes to existing tables.
- **Scalability**: The schema and API are designed for future elections beyond 2027.
- **Separation of Concerns**: Public user-facing views are strictly separated from admin-only controls.
- **Idempotency**: All migration scripts use `ON CONFLICT DO UPDATE` / `ON CONFLICT DO NOTHING` and are safe to re-run.

### 1.4 Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER-FACING (Public)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Politics │  │ Election │  │ Results  │  │  Party   │ │
│  │   Home   │  │ Calendar │  │  Portal  │  │ Directory│ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       │              │              │              │       │
├───────┴──────────────┴──────────────┴──────────────┴──────┤
│                    API LAYER (Next.js)                     │
│  /api/geo/*  /api/politics/parties  /api/politics/elections│
│  /api/politics/results  /api/politics/timetable           │
├───────────────────────────────────────────────────────────┤
│              DATABASE (Neon PostgreSQL)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────────┐  │
│  │  Geo    │ │ Parties │ │Elections│ │   Results    │  │
│  │ Tables  │ │ Table   │ │ Tables  │ │   Tables     │  │
│  └─────────┘ └─────────┘ └─────────┘ └───────────────┘  │
├───────────────────────────────────────────────────────────┤
│                   ADMIN DASHBOARD                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Party   │  │Timetable │  │ Results  │  │  Geo     │ │
│  │ Mgmt     │  │ Editor   │  │ Import   │  │  Data    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 1.5 Geo-Political Hierarchy

```
Country (Nigeria)
  └── Region (6 Geopolitical Zones)
       └── State (37: 36 States + FCT)
            └── LGA (774)
                 └── Ward (8,809)
                      └── Polling Unit (176,846)
```

---

## 2. Backend Schema

### 2.1 Existing Tables (Unchanged)

The following tables already exist and are populated:

| Table | Purpose | Records |
|-------|---------|---------|
| `regions` | 6 Geopolitical Zones | 6 |
| `states` | 37 States + FCT | 37 |
| `lgas` | Local Government Areas | 774 |
| `wards` | Electoral Wards | 8,809 |
| `political_positions` | Office types (President, Governor, etc.) | 9 |
| `political_persons` | Politician profiles | Seeded |
| `political_elections` | Election cycles | 1 (2027) |
| `office_holders` | Current incumbents | 38 |
| `election_candidates` | Election candidates | Ready for data |

### 2.2 New Table: `geo_polling_units`

Stores the 176,846 polling units from INEC's CVR portal.

```sql
CREATE TABLE IF NOT EXISTS geo_polling_units (
  id              SERIAL PRIMARY KEY,
  code            TEXT NOT NULL,          -- Full code e.g. '01/01/01/001'
  state_code      TEXT NOT NULL,          -- e.g. '01'
  state_id        INTEGER REFERENCES states(id) ON DELETE CASCADE,
  lga_code        TEXT NOT NULL,          -- e.g. '01'
  lga_id          INTEGER REFERENCES lgas(id) ON DELETE CASCADE,
  ward_code       TEXT NOT NULL,          -- e.g. '01'
  ward_id         INTEGER REFERENCES wards(id) ON DELETE CASCADE,
  pu_code         TEXT NOT NULL,          -- e.g. '001'
  name            TEXT NOT NULL,           -- e.g. 'RAILWAY QUARTERS I'
  location        TEXT,                    -- e.g. 'RAILWAY QUARTERS'
  portal_id       INTEGER,                -- INEC portal ID
  source          TEXT DEFAULT 'INEC',
  source_updated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ward_id, pu_code)
);
CREATE INDEX IF NOT EXISTS idx_pu_state ON geo_polling_units(state_id);
CREATE INDEX IF NOT EXISTS idx_pu_lga ON geo_polling_units(lga_id);
CREATE INDEX IF NOT EXISTS idx_pu_ward ON geo_polling_units(ward_id);
CREATE INDEX IF NOT EXISTS idx_pu_code ON geo_polling_units(code);
CREATE INDEX IF NOT EXISTS idx_pu_portal ON geo_polling_units(portal_id) WHERE portal_id IS NOT NULL;
```

**Source**: `scripts/data/inec-geo/polling-units.csv` (15 MB, 176,846 rows)
**Import**: `scripts/import-polling-units.mjs` (chunked batch insert, ~354 calls of 500 rows each)

### 2.3 Enhanced Table: `political_parties` (Additive Columns)

```sql
-- Additive ALTER statements (idempotent)
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  -- 'active' | 'deregistered' | 'suspended'
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS date_registered DATE;
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS date_deregistered DATE;
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS headquarters TEXT;
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

### 2.4 New Table: `election_timetable`

Represents a full election cycle (e.g., 2027 General Election).

```sql
CREATE TABLE IF NOT EXISTS election_timetable (
  id              SERIAL PRIMARY KEY,
  election_id     INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,           -- e.g. '2027 General Election Timetable'
  description     TEXT,
  published_date  DATE,                    -- When INEC published the timetable
  status          TEXT DEFAULT 'draft',    -- 'draft' | 'published' | 'archived'
  source_url      TEXT,                    -- INEC official URL
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timetable_election ON election_timetable(election_id);
```

### 2.5 New Table: `election_events`

Individual phases within a timetable (voter registration, primaries, campaign, election day, etc.).

```sql
CREATE TABLE IF NOT EXISTS election_events (
  id              SERIAL PRIMARY KEY,
  timetable_id    INTEGER NOT NULL REFERENCES election_timetable(id) ON DELETE CASCADE,
  election_id     INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,           -- e.g. 'Voter Registration'
  description     TEXT,
  event_type      TEXT NOT NULL,           -- 'voter_registration' | 'party_primaries' |
                                           -- 'campaign_period' | 'election_day' |
                                           -- 'collation' | 'result_announcement' |
                                           -- 'voter_verification' | 'party_registration'
  geo_scope       TEXT DEFAULT 'national', -- 'national' | 'state' | 'lga'
  state_id        INTEGER REFERENCES states(id), -- NULL = national scope
  start_date      DATE,
  end_date        DATE,
  sort_order      INTEGER DEFAULT 99,
  status          TEXT DEFAULT 'scheduled', -- 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
  notes           TEXT,
  source_url      TEXT,                    -- INEC reference URL
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_timetable ON election_events(timetable_id);
CREATE INDEX IF NOT EXISTS idx_events_election ON election_events(election_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON election_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_dates ON election_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON election_events(status);
CREATE INDEX IF NOT EXISTS idx_events_state ON election_events(state_id);
```

### 2.6 New Table: `election_results`

Stores election results at any geo level — national, state, LGA, ward, or polling unit. Designed to be neutral and factual.

```sql
CREATE TABLE IF NOT EXISTS election_results (
  id                  SERIAL PRIMARY KEY,
  election_id         INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
  position_id         INTEGER REFERENCES political_positions(id),
  party_acronym       TEXT,                 -- e.g. 'APC', 'PDP'
  candidate_name      TEXT,                 -- Denormalized for quick display
  candidate_id        INTEGER REFERENCES political_persons(id),
  votes               INTEGER DEFAULT 0,    -- Votes received
  -- Geo level (exactly one should be set; NULLs mean national level)
  geo_level           TEXT NOT NULL,        -- 'national' | 'state' | 'lga' | 'ward' | 'polling_unit'
  state_id            INTEGER REFERENCES states(id),
  lga_id              INTEGER REFERENCES lgas(id),
  ward_id             INTEGER REFERENCES wards(id),
  polling_unit_id     INTEGER REFERENCES geo_polling_units(id),
  -- Result metadata
  total_registered_voters  INTEGER,
  total_accredited_voters  INTEGER,
  total_valid_votes        INTEGER,
  total_rejected_votes     INTEGER,
  total_votes_cast         INTEGER,
  result_type         TEXT DEFAULT 'official', -- 'official' | 'provisional' | 'cancelled'
  status              TEXT DEFAULT 'pending',  -- 'pending' | 'verified' | 'published' | 'disputed'
  source_url          TEXT,                   -- INEC iREV or official source
  source_name         TEXT DEFAULT 'INEC',
  source_updated_at   TIMESTAMPTZ,
  -- Audit
  declared_at         TIMESTAMPTZ,            -- When result was officially declared
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_results_election ON election_results(election_id);
CREATE INDEX IF NOT EXISTS idx_results_position ON election_results(position_id);
CREATE INDEX IF NOT EXISTS idx_results_party ON election_results(party_acronym);
CREATE INDEX IF NOT EXISTS idx_results_geo ON election_results(geo_level, state_id, lga_id, ward_id, polling_unit_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON election_results(status);
CREATE INDEX IF NOT EXISTS idx_results_state ON election_results(state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_results_lga ON election_results(lga_id) WHERE lga_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_results_ward ON election_results(ward_id) WHERE ward_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_results_pu ON election_results(polling_unit_id) WHERE polling_unit_id IS NOT NULL;
```

### 2.7 New Table: `election_result_summaries`

Aggregated/cached result summaries for quick dashboard loading.

```sql
CREATE TABLE IF NOT EXISTS election_result_summaries (
  id                  SERIAL PRIMARY KEY,
  election_id         INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
  position_id         INTEGER REFERENCES political_positions(id),
  geo_level           TEXT NOT NULL,        -- 'national' | 'state' | 'lga' | 'ward'
  state_id            INTEGER REFERENCES states(id),
  lga_id              INTEGER REFERENCES lgas(id),
  ward_id             INTEGER REFERENCES wards(id),
  total_valid_votes   INTEGER DEFAULT 0,
  total_rejected_votes INTEGER DEFAULT 0,
  total_votes_cast    INTEGER DEFAULT 0,
  total_registered_voters INTEGER DEFAULT 0,
  total_accredited_voters INTEGER DEFAULT 0,
  leading_party       TEXT,                  -- Denormalized for quick display
  leading_votes       INTEGER DEFAULT 0,
  results_count       INTEGER DEFAULT 0,    -- Number of PU results included
  status              TEXT DEFAULT 'pending',
  computed_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_summary_election ON election_result_summaries(election_id);
CREATE INDEX IF NOT EXISTS idx_summary_position ON election_result_summaries(position_id);
CREATE INDEX IF NOT EXISTS idx_summary_geo ON election_result_summaries(geo_level, state_id, lga_id, ward_id);
```

### 2.8 Entity Relationship Summary

```
political_elections (1) ──< election_timetable (1) ──< election_events (N)
political_elections (1) ──< election_results (N)
political_elections (1) ──< election_result_summaries (N)
political_positions (1) ──< election_results (N)
political_parties (1) ──< election_results (N) [via party_acronym]
political_persons (1) ──< election_results (N) [via candidate_id]

states (1) ──< geo_polling_units (N)
lgas (1) ──< geo_polling_units (N)
wards (1) ──< geo_polling_units (N)

election_events (N) ──> states (1) [state_id, nullable for national]
election_results (N) ──> states, lgas, wards, geo_polling_units [geo hierarchy]
```

---

## 3. API Specification

### 3.1 Geo Endpoints

#### `GET /api/geo/states`
List all 37 states with their geopolitical zones.

**Response 200:**
```json
{
  "states": [
    {
      "id": 1,
      "name": "Abia",
      "code": "01",
      "portal_id": 1,
      "region_id": 4,
      "region_name": "South East",
      "region_code": "SE",
      "lat": 5.45,
      "lng": 7.50
    }
  ],
  "total": 37
}
```

#### `GET /api/geo/states/{id}/lgas`
List LGAs for a given state.

**Response 200:**
```json
{
  "lgas": [
    { "id": 1, "name": "Aba North", "code": "01", "state_id": 1, "portal_id": 1 }
  ],
  "total": 17
}
```

#### `GET /api/geo/lgas/{id}/wards`
List wards for a given LGA.

**Response 200:**
```json
{
  "wards": [
    { "id": 1, "name": "Eziama", "code": "01", "lga_id": 1, "state_id": 1 }
  ],
  "total": 12
}
```

#### `GET /api/geo/wards/{id}/polling-units`
List polling units for a given ward.

**Query params:** `?limit=500&offset=0`

**Response 200:**
```json
{
  "pollingUnits": [
    {
      "id": 1,
      "code": "01/01/01/001",
      "pu_code": "001",
      "name": "RAILWAY QUARTERS I",
      "location": "RAILWAY QUARTERS",
      "ward_id": 1,
      "lga_id": 1,
      "state_id": 1,
      "portal_id": 1
    }
  ],
  "total": 15,
  "limit": 500,
  "offset": 0
}
```

#### `GET /api/geo/polling-units?state_id=&lga_id=&ward_id=`
Search polling units by geo hierarchy. Supports pagination.

#### `GET /api/geo/hierarchy` (Existing, Enhanced)
Returns the full geo tree. Now includes polling unit counts per ward.

### 3.2 Parties Endpoints

#### `GET /api/politics/parties`
List all registered political parties.

**Query params:** `?status=active&search=APC`

**Response 200:**
```json
{
  "parties": [
    {
      "id": 1,
      "acronym": "APC",
      "name": "All Progressives Congress",
      "color": "#006633",
      "logo_url": "https://...",
      "status": "active",
      "date_registered": "2013-08-01",
      "headquarters": "Abuja, FCT",
      "total_candidates": 15,
      "total_office_holders": 38
    }
  ],
  "total": 18
}
```

#### `GET /api/politics/parties/{id}`
Single party detail with candidates and office holders grouped by office.

**Response 200:**
```json
{
  "party": {
    "id": 1,
    "acronym": "APC",
    "name": "All Progressives Congress",
    "color": "#006633",
    "logo_url": "https://...",
    "status": "active",
    "date_registered": "2013-08-01",
    "headquarters": "Abuja, FCT",
    "source_url": "https://inecnigeria.org/...",
    "metadata": {}
  },
  "totalCandidates": 15,
  "totalOfficeHolders": 38,
  "candidates": [...],
  "officeHolders": [...],
  "byOffice": {
    "president": [...],
    "governor": [...],
    "senator": [...]
  }
}
```

### 3.3 Elections & Timetable Endpoints

#### `GET /api/politics/elections`
List all election cycles.

**Response 200:**
```json
{
  "elections": [
    {
      "id": 1,
      "year": 2027,
      "name": "2027 Nigerian General Election",
      "type": "general",
      "geo_scope": "national",
      "election_date": "2027-02-18",
      "status": "upcoming",
      "has_timetable": true,
      "timetable_id": 1
    }
  ],
  "total": 1
}
```

#### `GET /api/politics/elections/{id}`
Single election detail.

#### `GET /api/politics/elections/{id}/timetable`
Get the full timetable with all events/phases for an election.

**Response 200:**
```json
{
  "timetable": {
    "id": 1,
    "election_id": 1,
    "title": "2027 General Election Timetable",
    "description": "Official INEC timetable for the 2027 General Election",
    "published_date": "2026-01-15",
    "status": "published",
    "source_url": "https://inecnigeria.org/timetable",
    "events": [
      {
        "id": 1,
        "timetable_id": 1,
        "election_id": 1,
        "name": "Voter Registration (CVR)",
        "description": "Continuous Voter Registration exercise",
        "event_type": "voter_registration",
        "geo_scope": "national",
        "state_id": null,
        "start_date": "2026-06-01",
        "end_date": "2026-09-30",
        "sort_order": 1,
        "status": "completed",
        "notes": "Concluded nationwide",
        "source_url": "https://inecnigeria.org/cvr"
      },
      {
        "id": 2,
        "name": "Party Primaries",
        "event_type": "party_primaries",
        "start_date": "2026-10-01",
        "end_date": "2026-12-15",
        "sort_order": 2,
        "status": "ongoing"
      },
      {
        "id": 3,
        "name": "Campaign Period",
        "event_type": "campaign_period",
        "start_date": "2026-12-16",
        "end_date": "2027-02-17",
        "sort_order": 3,
        "status": "scheduled"
      },
      {
        "id": 4,
        "name": "Election Day",
        "event_type": "election_day",
        "start_date": "2027-02-18",
        "end_date": "2027-02-18",
        "sort_order": 4,
        "status": "scheduled"
      },
      {
        "id": 5,
        "name": "Result Collation & Announcement",
        "event_type": "collation",
        "start_date": "2027-02-18",
        "end_date": "2027-02-25",
        "sort_order": 5,
        "status": "scheduled"
      }
    ]
  }
}
```

### 3.4 Results Endpoints

#### `GET /api/politics/results`
Query election results with multi-level geo drill-down.

**Query params:**
- `election_id` (required) — Election cycle ID
- `office_id` (optional) — Position ID (president, governor, etc.)
- `state_id` (optional) — Filter by state
- `lga_id` (optional) — Filter by LGA
- `ward_id` (optional) — Filter by ward
- `polling_unit_id` (optional) — Filter by specific PU
- `geo_level` (optional) — `national` | `state` | `lga` | `ward` | `polling_unit`
- `party` (optional) — Filter by party acronym
- `status` (optional) — Filter by result status
- `limit` (optional, default 100, max 1000)
- `offset` (optional, default 0)

**Response 200:**
```json
{
  "results": [
    {
      "id": 1,
      "election_id": 1,
      "position_id": 1,
      "position_name": "President",
      "party_acronym": "APC",
      "party_name": "All Progressives Congress",
      "party_color": "#006633",
      "candidate_name": "Bola Ahmed Tinubu",
      "candidate_id": 1,
      "votes": 8794726,
      "geo_level": "national",
      "state_id": null,
      "lga_id": null,
      "ward_id": null,
      "polling_unit_id": null,
      "total_registered_voters": 93441856,
      "total_accredited_voters": 24965619,
      "total_valid_votes": 24025949,
      "total_rejected_votes": 939668,
      "total_votes_cast": 24965617,
      "result_type": "official",
      "status": "published",
      "source_url": "https://inecnigeria.org/...",
      "declared_at": "2027-02-25T10:00:00Z"
    }
  ],
  "summary": {
    "total_valid_votes": 24025949,
    "total_rejected_votes": 939668,
    "total_votes_cast": 24965617,
    "total_accredited_voters": 24965619,
    "total_registered_voters": 93441856,
    "parties": [
      { "acronym": "APC", "name": "All Progressives Congress", "votes": 8794726, "percentage": 36.61 },
      { "acronym": "PDP", "name": "Peoples Democratic Party", "votes": 6742816, "percentage": 28.05 }
    ]
  },
  "total": 2,
  "limit": 100,
  "offset": 0
}
```

#### `GET /api/politics/results/summary`
Aggregated result summaries at state/LGA/ward level for dashboard rendering.

**Query params:** `election_id`, `office_id`, `geo_level`, `state_id`, `lga_id`

**Response 200:**
```json
{
  "summaries": [
    {
      "id": 1,
      "election_id": 1,
      "position_id": 1,
      "geo_level": "state",
      "state_id": 1,
      "state_name": "Abia",
      "total_valid_votes": 500000,
      "total_rejected_votes": 15000,
      "total_votes_cast": 515000,
      "leading_party": "APC",
      "leading_votes": 250000,
      "results_count": 184,
      "status": "published"
    }
  ],
  "total": 37
}
```

#### `GET /api/politics/results/polling-unit/{id}`
Detailed result breakdown for a single polling unit.

### 3.5 Integration with Existing Politics Endpoints

The existing endpoints remain unchanged:

| Endpoint | Status |
|----------|--------|
| `GET /api/politics/office-holders` | Unchanged |
| `GET /api/politics/candidates` | Unchanged |
| `GET /api/politics/parties` | Enhanced (new columns) |
| `GET /api/politicians/[slug]` | Unchanged |
| `GET /api/geo/hierarchy` | Enhanced (PU counts) |
| `GET /api/geo/wards` | Unchanged |

---

## 4. Frontend / Mobile UI Specs

### 4.1 Election Calendar / Timetable Page

**Route:** `/politics/elections`
**Mobile:** React Native equivalent screen

**Layout:**
- Header: "Election Calendar" with election selector dropdown (e.g., "2027 General Election")
- Timeline view (vertical) showing each phase:
  - Phase name, date range, status badge (completed/ongoing/scheduled)
  - Color-coded by event_type
  - Click to expand for details
- Calendar view (toggle): Month grid showing event date ranges
- Filter: By geo scope (national/state-specific)

**Component Tree:**
```
ElectionCalendarPage
├── ElectionSelector (dropdown)
├── ViewToggle (Timeline | Calendar)
├── TimetableTimeline
│   ├── TimelineEvent (per phase)
│   │   ├── EventIcon (type-based)
│   │   ├── EventName + DateRange
│   │   ├── StatusBadge
│   │   └── EventDetails (expandable)
│   └── CurrentPositionIndicator
├── CalendarGrid (alternative view)
└── SourceAttribution ("Source: INEC")
```

**Data Flow:**
```
GET /api/politics/elections → election list
GET /api/politics/elections/{id}/timetable → full timetable with events
```

### 4.2 iREV-Style Result Viewing Portal

**Route:** `/politics/results`
**Mobile:** React Native equivalent screen

**Entry Screen:**
1. Election selector (e.g., "2027 General Election")
2. Office selector (President, Governor, Senate, HoR, State Assembly, LG Chair, Councillor)
3. Geo level selector (National, State, LGA, Ward, Polling Unit)
4. If State/LGA/Ward/PU selected: cascading geo dropdowns

**Results View:**
- Summary cards: Total valid votes, rejected votes, votes cast, accredited voters
- Party results table: Party | Votes | Percentage | Bar chart
- Geo drill-down table: Results by state/LGA/ward/PU
- Filters: sort by votes/party/geo unit
- Download/Export button (CSV)

**Drill-down Navigation:**
```
National → click State → State results
  → click LGA → LGA results
    → click Ward → Ward results
      → click PU → Polling Unit breakdown
```

**Component Tree:**
```
ResultsPortalPage
├── ResultFilters
│   ├── ElectionSelector
│   ├── OfficeSelector
│   ├── GeoLevelSelector
│   └── CascadingGeoSelectors (State → LGA → Ward → PU)
├── ResultSummaryCards
│   ├── TotalValidVotes
│   ├── TotalRejectedVotes
│   ├── TotalVotesCast
│   └── TotalAccreditedVoters
├── PartyResultsTable
│   ├── PartyColumn
│   ├── VotesColumn
│   ├── PercentageColumn
│   └── VoteBarChart
├── GeoDrillDownTable
│   ├── GeoUnitColumn
│   ├── LeadingPartyColumn
│   ├── TotalVotesColumn
│   └── ActionColumn (drill down)
├── PollingUnitDetail (when PU selected)
└── SourceAttribution ("Source: INEC iREV")
```

**Design Notes:**
- Neutral color palette (no party-biased colors in UI chrome)
- Party colors only used in data visualization (bar charts, table cells)
- "No predictions" banner: "Results are displayed as officially declared by INEC. No projections or predictions are made."
- Loading states with skeleton loaders
- Empty states: "Results have not been declared for this election/office/geo unit."

### 4.3 Party Directory & Detail Pages

**Route:** `/politics/parties` (Directory)
**Route:** `/politics/parties/[id]` (Detail — integrated with existing CRL Party Page)

**Directory Layout:**
- Grid of party cards (logo, acronym, name, status badge)
- Search bar
- Filter: All / Active / Deregistered
- Sort: Alphabetical / Date Registered

**Detail Page Layout (CRL Integration):**
- Party header: Logo, name, acronym, status, date registered, headquarters
- Tabbed interface:
  - Overview: Party info, source link
  - Candidates: All registered candidates grouped by office
  - Office Holders: Current elected officials
  - Results: Historical election results
- Source attribution: "Data sourced from INEC"

**Component Tree:**
```
PartyDirectoryPage
├── PartySearchBar
├── PartyFilterTabs (All | Active | Deregistered)
├── PartyGrid
│   └── PartyCard
│       ├── PartyLogo
│       ├── PartyAcronym + Name
│       └── StatusBadge
└── PartySortDropdown

PartyDetailPage (CRL Integration)
├── PartyHeader
│   ├── Logo
│   ├── Name + Acronym
│   ├── StatusBadge
│   ├── MetaInfo (date_registered, HQ)
│   └── SourceLink
├── PartyTabs
│   ├── OverviewTab
│   ├── CandidatesTab (grouped by office)
│   ├── OfficeHoldersTab
│   └── ResultsTab
└── SourceAttribution
```

### 4.4 Geo Navigation UI

**Cascading Selectors Component:**

```
GeoSelector (reusable)
├── StateSelect (dropdown, populated from /api/geo/states)
├── LGASelect (dropdown, populated from /api/geo/states/{id}/lgas)
├── WardSelect (dropdown, populated from /api/geo/lgas/{id}/wards)
└── PollingUnitSelect (dropdown, populated from /api/geo/wards/{id}/polling-units)
```

**Behavior:**
- Each dropdown is disabled until its parent has a selection
- Selecting a parent clears child selections
- Supports "Any" option (null value) for filtering
- Searchable dropdowns for large lists (especially polling units)
- Mobile: Native picker or bottom-sheet selector

**Usage in Politics Pages:**
- Office holders filter: State → LGA → Ward
- Candidates filter: State → LGA → Ward → PU
- Results portal: State → LGA → Ward → PU (drill-down)
- Election calendar: State filter (for state-specific events)

---

## 5. Admin Dashboard Specs

### 5.1 Party Management Module

**Route:** `/admin/politics/parties`

**Features:**
- Data table: Columns — Acronym, Name, Color, Status, Date Registered, Actions
- Create/Edit party dialog (form fields: acronym, name, color picker, logo URL, status dropdown, date registered, headquarters, source URL)
- Bulk actions: Activate, Deregister, Export CSV
- Search and filter by status
- Audit log: All changes logged to `audit_logs`

**API:**
- `POST /api/admin/politics/parties` — Create/Update
- `DELETE /api/admin/politics/parties/[id]` — Soft delete (set status to deregistered)
- `POST /api/admin/politics/parties/[id]/status` — Change status

### 5.2 Election & Timetable Editor Module

**Route:** `/admin/politics/elections`

**Features:**
- Elections list table: Year, Name, Type, Date, Status, Actions
- Create election dialog
- Timetable editor:
  - Create timetable for an election
  - Add/edit/delete events (phases)
  - Drag-to-reorder events (sort_order)
  - Date pickers for start/end dates
  - Event type selector
  - Geo scope selector (national/state-specific)
  - Status management (scheduled → ongoing → completed)
  - Source URL field (INEC reference)
- Publish/Archive timetable toggle

**API:**
- `POST /api/admin/politics/elections` — Create election
- `POST /api/admin/politics/elections/[id]/timetable` — Create/update timetable
- `POST /api/admin/politics/events` — Create event
- `PUT /api/admin/politics/events/[id]` — Update event
- `DELETE /api/admin/politics/events/[id]` — Delete event
- `POST /api/admin/politics/events/[id]/status` — Update event status

### 5.3 Results Management Module

**Route:** `/admin/politics/results`

**Features:**
- Results import interface:
  - Upload CSV (INEC iREV format)
  - Map CSV columns to schema fields
  - Preview before import
  - Bulk import with validation
- Results table: Election, Office, Party, Candidate, Votes, Geo Level, Status
- Result verification workflow:
  - Pending → Verified → Published
  - Dispute flagging
- Result summaries management
- Export results as CSV/JSON

**API:**
- `POST /api/admin/politics/results/import` — Bulk import from CSV
- `POST /api/admin/politics/results` — Create/update result
- `PUT /api/admin/politics/results/[id]` — Update result
- `POST /api/admin/politics/results/[id]/status` — Update status
- `DELETE /api/admin/politics/results/[id]` — Delete result
- `POST /api/admin/politics/results/summarize` — Trigger summary computation

### 5.4 Geo Data Management Module

**Route:** `/admin/politics/geo`

**Features:**
- Read-only overview of geo data:
  - State count, LGA count, Ward count, PU count
  - Data source attribution
  - Last sync date
- "Sync Polling Units" button (triggers import script)
- "Sync Geo from INEC" button (re-runs geo import)
- Geo data browser (browse states → LGAs → wards → PUs)
- Source URL links to INEC

**Notes:**
- Geo data sourced from INEC is read-only (not editable)
- Admin can trigger re-sync but cannot manually edit individual records
- All sync operations are logged

**API:**
- `POST /api/admin/politics/seed-geo` — Trigger geo sync (existing)
- `POST /api/admin/politics/sync-polling-units` — Trigger PU import
- `GET /api/admin/politics/geo-stats` — Get geo data statistics

---

## 6. Data Sources & ETL

### 6.1 INEC Geography Data

| Data | Source | Records | File | Import Script |
|------|--------|---------|------|---------------|
| States | [nigeria-inec-geo](https://github.com/saidiadegoke/nigeria-inec-geo) | 37 | `scripts/data/inec-geo/states.json` | `scripts/import-inec-geo.mjs` |
| LGAs | [nigeria-inec-geo](https://github.com/saidiadegoke/nigeria-inec-geo) | 774 | `scripts/data/inec-geo/lgas.json` | `scripts/import-inec-geo.mjs` |
| Wards | [nigeria-inec-geo](https://github.com/saidiadegoke/nigeria-inec-geo) | 8,809 | `scripts/data/inec-geo/wards.json` | `scripts/import-inec-geo.mjs` |
| Polling Units | [nigeria-inec-geo](https://github.com/saidiadegoke/nigeria-inec-geo) | 176,846 | `scripts/data/inec-geo/polling-units.csv` | `scripts/import-polling-units.mjs` |

### 6.2 INEC Official Site Data

| Data | Source URL | Import Method |
|------|-----------|---------------|
| Political Parties | [inecnigeria.org](https://inecnigeria.org/) | Admin manual entry / API sync |
| Election Timetable | [inecnigeria.org](https://inecnigeria.org/) | Admin manual entry from official publication |
| Results (iREV) | [inecnigeria.org](https://inecnigeria.org/) | Admin CSV import from iREV portal |

### 6.3 Polling Units Import Pipeline

**Script:** `scripts/import-polling-units.mjs`

**Process:**
1. Parse CSV (176,846 rows)
2. Build lookup maps: state_code → state_id, lga_code+state_code → lga_id, ward_code+lga_id → ward_id
3. Batch insert (500 rows per batch, ~354 HTTP calls)
4. Use `ON CONFLICT (ward_id, pu_code) DO UPDATE` for idempotency
5. Estimated runtime: ~5-8 minutes on Neon serverless

**CSV Column Mapping:**
| CSV Column | DB Column | Notes |
|-----------|-----------|-------|
| state_code | state_code | Direct |
| state_name | (lookup) | Used for state_id resolution |
| lga_code | lga_code | Direct |
| lga_name | (lookup) | Used for lga_id resolution |
| ward_code | ward_code | Direct |
| ward_name | (lookup) | Used for ward_id resolution |
| pu_code | pu_code | Direct |
| pu_name | name | Direct |
| pu_location | location | Direct |
| full_code | code | Direct (e.g. '01/01/01/001') |
| portal_id | portal_id | Direct |

---

## 7. Deployment

### 7.1 Migration Strategy

The migration follows the existing pattern used for `news_external` and engagement tables:

1. **Standalone DDL Block**: Add `ensurePoliticsV11Tables()` function to `db.ts` — runs before the schema-version fast-path, idempotent, safe for cold starts.
2. **Dedicated Migration Script**: `scripts/migrate-politics-v11.mjs` for explicit Neon sync.
3. **Prisma Schema Update**: Add new models to `prisma/schema.prisma` for type generation.
4. **Schema Version Bump**: `2026-09-13-v11`

### 7.2 Deployment Steps

1. **Push to GitHub**: Feature branch `feature/politics-v11`
2. **Sync to Neon**: Run `scripts/migrate-politics-v11.mjs` with `DATABASE_URL`
3. **Import Polling Units**: Run `scripts/import-polling-units.mjs` with `DATABASE_URL`
4. **Deploy to Vercel**: `vercel --prod` (or auto-deploy from GitHub)

### 7.3 Environment Variables (Required)

```env
DATABASE_URL=postgresql://...@ep-xxx.neon.tech/9jatruth?sslmode=require
```

### 7.4 Post-Deployment Verification

- [ ] `GET /api/geo/states` returns 37 states
- [ ] `GET /api/geo/wards/{id}/polling-units` returns PUs
- [ ] `GET /api/politics/parties` returns parties with new columns
- [ ] `GET /api/politics/elections` returns election cycles
- [ ] `GET /api/politics/elections/{id}/timetable` returns timetable with events
- [ ] `GET /api/politics/results` returns empty results (no data yet)
- [ ] Existing politics routes still work
- [ ] No "predictions" language in results UI
