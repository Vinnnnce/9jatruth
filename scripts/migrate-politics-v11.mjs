#!/usr/bin/env node
/**
 * Politics v11 Migration Script
 * Creates all new tables and enhances existing ones for the Politics feature.
 *
 * Tables created:
 *   - geo_polling_units
 *   - election_timetable
 *   - election_events
 *   - election_results
 *   - election_result_summaries
 *
 * Columns added to political_parties:
 *   - status, date_registered, date_deregistered, headquarters,
 *     source_url, source_name, source_updated_at, metadata, updated_at
 *
 * Seeds a default election timetable for the 2027 General Election.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/migrate-politics-v11.mjs
 *
 * Safe to re-run — all statements are idempotent.
 */
import { neon } from "@neondatabase/serverless";

const ddls = [
  // geo_polling_units
  `CREATE TABLE IF NOT EXISTS geo_polling_units (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    state_code TEXT NOT NULL,
    state_id INTEGER NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    lga_code TEXT NOT NULL,
    lga_id INTEGER NOT NULL REFERENCES lgas(id) ON DELETE CASCADE,
    ward_code TEXT NOT NULL,
    ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    pu_code TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    portal_id INTEGER,
    source TEXT DEFAULT 'INEC',
    source_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ward_id, pu_code)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pu_state ON geo_polling_units(state_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pu_lga ON geo_polling_units(lga_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pu_ward ON geo_polling_units(ward_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pu_code ON geo_polling_units(code)`,

  // election_timetable
  `CREATE TABLE IF NOT EXISTS election_timetable (
    id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    published_date DATE,
    status TEXT DEFAULT 'draft',
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_timetable_election ON election_timetable(election_id)`,

  // election_events
  `CREATE TABLE IF NOT EXISTS election_events (
    id SERIAL PRIMARY KEY,
    timetable_id INTEGER NOT NULL REFERENCES election_timetable(id) ON DELETE CASCADE,
    election_id INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    geo_scope TEXT DEFAULT 'national',
    state_id INTEGER REFERENCES states(id),
    start_date DATE,
    end_date DATE,
    sort_order INTEGER DEFAULT 99,
    status TEXT DEFAULT 'scheduled',
    notes TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_timetable ON election_events(timetable_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_election ON election_events(election_id)`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON election_events(event_type)`,
  `CREATE INDEX IF NOT EXISTS idx_events_dates ON election_events(start_date, end_date)`,
  `CREATE INDEX IF NOT EXISTS idx_events_status ON election_events(status)`,
  `CREATE INDEX IF NOT EXISTS idx_events_state ON election_events(state_id)`,

  // election_results
  `CREATE TABLE IF NOT EXISTS election_results (
    id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
    position_id INTEGER REFERENCES political_positions(id),
    party_acronym TEXT,
    candidate_name TEXT,
    candidate_id INTEGER REFERENCES political_persons(id),
    votes INTEGER DEFAULT 0,
    geo_level TEXT NOT NULL,
    state_id INTEGER REFERENCES states(id),
    lga_id INTEGER REFERENCES lgas(id),
    ward_id INTEGER REFERENCES wards(id),
    polling_unit_id INTEGER REFERENCES geo_polling_units(id),
    total_registered_voters INTEGER,
    total_accredited_voters INTEGER,
    total_valid_votes INTEGER,
    total_rejected_votes INTEGER,
    total_votes_cast INTEGER,
    result_type TEXT DEFAULT 'official',
    status TEXT DEFAULT 'pending',
    source_url TEXT,
    source_name TEXT DEFAULT 'INEC',
    source_updated_at TIMESTAMPTZ,
    declared_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_results_election ON election_results(election_id)`,
  `CREATE INDEX IF NOT EXISTS idx_results_position ON election_results(position_id)`,
  `CREATE INDEX IF NOT EXISTS idx_results_party ON election_results(party_acronym)`,
  `CREATE INDEX IF NOT EXISTS idx_results_status ON election_results(status)`,
  `CREATE INDEX IF NOT EXISTS idx_results_state ON election_results(state_id) WHERE state_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_results_lga ON election_results(lga_id) WHERE lga_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_results_ward ON election_results(ward_id) WHERE ward_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_results_pu ON election_results(polling_unit_id) WHERE polling_unit_id IS NOT NULL`,

  // election_result_summaries
  `CREATE TABLE IF NOT EXISTS election_result_summaries (
    id SERIAL PRIMARY KEY,
    election_id INTEGER NOT NULL REFERENCES political_elections(id) ON DELETE CASCADE,
    position_id INTEGER REFERENCES political_positions(id),
    geo_level TEXT NOT NULL,
    state_id INTEGER REFERENCES states(id),
    lga_id INTEGER REFERENCES lgas(id),
    ward_id INTEGER REFERENCES wards(id),
    total_valid_votes INTEGER DEFAULT 0,
    total_rejected_votes INTEGER DEFAULT 0,
    total_votes_cast INTEGER DEFAULT 0,
    total_registered_voters INTEGER,
    total_accredited_voters INTEGER,
    leading_party TEXT,
    leading_votes INTEGER DEFAULT 0,
    results_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    computed_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_summary_election ON election_result_summaries(election_id)`,
  `CREATE INDEX IF NOT EXISTS idx_summary_position ON election_result_summaries(position_id)`,

  // Enhanced political_parties columns (additive)
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS date_registered DATE`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS date_deregistered DATE`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS headquarters TEXT`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS source_url TEXT`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS source_name TEXT`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'`,
  `ALTER TABLE political_parties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
];

const TIMETABLE_EVENTS = [
  { name: "Continuous Voter Registration (CVR)", event_type: "voter_registration", start: "2026-06-01", end: "2026-09-30", sort: 1, status: "completed" },
  { name: "Party Primaries", event_type: "party_primaries", start: "2026-10-01", end: "2026-12-15", sort: 2, status: "scheduled" },
  { name: "Campaign Period", event_type: "campaign_period", start: "2026-12-16", end: "2027-02-17", sort: 3, status: "scheduled" },
  { name: "Election Day", event_type: "election_day", start: "2027-02-18", end: "2027-02-18", sort: 4, status: "scheduled" },
  { name: "Result Collation & Announcement", event_type: "collation", start: "2027-02-18", end: "2027-02-25", sort: 5, status: "scheduled" },
  { name: "Result Publication (iREV)", event_type: "result_announcement", start: "2027-02-25", end: "2027-03-04", sort: 6, status: "scheduled" },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  console.log("Running Politics v11 migration...\n");

  // 1. Execute DDL statements
  console.log("1. Creating tables and indexes...");
  for (const ddl of ddls) {
    try {
      await sql.query(ddl);
    } catch (e) {
      console.error(`  DDL failed: ${e.message}`);
    }
  }
  console.log(`  Done (${ddls.length} statements executed).\n`);

  // 2. Seed default timetable for 2027 election
  console.log("2. Seeding default 2027 election timetable...");
  const election = (await sql`SELECT id, name FROM political_elections WHERE year = 2027 LIMIT 1`)[0];
  if (!election) {
    console.log("  2027 election not found. Creating it...");
    const created = (await sql`INSERT INTO political_elections (year, name, type, geo_scope, election_date, status) VALUES (2027, '2027 Nigerian General Election', 'general', 'national', '2027-02-18', 'upcoming') ON CONFLICT (year, type, geo_scope) DO UPDATE SET name = EXCLUDED.name RETURNING id`)[0];
    if (!created) { console.log("  Could not create election."); process.exit(1); }
    await seedTimetable(sql, created.id);
  } else {
    console.log(`  Found election: ${election.name} (id: ${election.id})`);
    await seedTimetable(sql, election.id);
  }

  // 3. Update schema version
  console.log("\n3. Updating schema version...");
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`INSERT INTO schema_migrations (version) VALUES ('2026-09-13-v11') ON CONFLICT (version) DO UPDATE SET version = EXCLUDED.version`;
  console.log("  Schema version set to 2026-09-13-v11");

  // 4. Summary
  console.log("\n4. Migration summary:");
  const puCount = (await sql`SELECT COUNT(*) c FROM geo_polling_units`)[0]?.c ?? 0;
  const ttCount = (await sql`SELECT COUNT(*) c FROM election_timetable`)[0]?.c ?? 0;
  const evCount = (await sql`SELECT COUNT(*) c FROM election_events`)[0]?.c ?? 0;
  const resCount = (await sql`SELECT COUNT(*) c FROM election_results`)[0]?.c ?? 0;
  const partyCount = (await sql`SELECT COUNT(*) c FROM political_parties`)[0]?.c ?? 0;

  console.log(`  geo_polling_units: ${puCount} rows`);
  console.log(`  election_timetable: ${ttCount} rows`);
  console.log(`  election_events: ${evCount} rows`);
  console.log(`  election_results: ${resCount} rows`);
  console.log(`  political_parties: ${partyCount} rows (with enhanced columns)`);
  console.log("\nMigration complete!");
}

async function seedTimetable(sql, electionId) {
  const existing = (await sql`SELECT id FROM election_timetable WHERE election_id = ${electionId} LIMIT 1`)[0];
  if (existing) {
    console.log("  Timetable already exists. Skipping seed.");
    return;
  }

  const tt = (await sql`INSERT INTO election_timetable (election_id, title, description, published_date, status, source_url) VALUES (${electionId}, '2027 General Election Timetable', 'Official INEC timetable for the 2027 Nigerian General Election. Dates are indicative and based on INEC published schedules.', '2026-01-15', 'published', 'https://inecnigeria.org/') RETURNING id`)[0];
  console.log(`  Created timetable (id: ${tt.id})`);

  for (const ev of TIMETABLE_EVENTS) {
    await sql`INSERT INTO election_events (timetable_id, election_id, name, description, event_type, geo_scope, start_date, end_date, sort_order, status, source_url) VALUES (${tt.id}, ${electionId}, ${ev.name}, ${ev.name + ' phase of the 2027 General Election cycle.'}, ${ev.event_type}, 'national', ${ev.start}, ${ev.end}, ${ev.sort}, ${ev.status}, 'https://inecnigeria.org/') ON CONFLICT DO NOTHING`;
  }
  console.log(`  Seeded ${TIMETABLE_EVENTS.length} events.`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
