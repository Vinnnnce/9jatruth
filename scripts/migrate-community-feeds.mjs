/**
 * Migration + seed script for the Community Feeds system.
 * ─────────────────────────────────────────────────────────────────────────
 * Run against your Neon database to create the `wards` + `feeds` tables,
 * add the PostGIS geography column + GiST index (when available), seed sample
 * wards for the already-seeded LGAs, and register the schema version marker.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/migrate-community-feeds.mjs
 *
 * This mirrors the DDL in src/lib/db.ts (ensureDbInitialized) so it can be
 * applied directly without booting the Next.js app — handy for first-time
 * Neon provisioning or CI migrations.
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set. Export it or pass it inline.");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const SCHEMA_VERSION = "2026-08-27-community-feeds-v1";

async function run() {
  console.log("→ Community Feeds migration starting…");

  // ── Wards table ────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS wards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      state_id INTEGER REFERENCES states(id) ON DELETE SET NULL,
      lga_id INTEGER REFERENCES lgas(id) ON DELETE CASCADE,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (lga_id, name)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_wards_lga ON wards(lga_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wards_state ON wards(state_id)`;
  await sql`ALTER TABLE communities ADD COLUMN IF NOT EXISTS ward_id INTEGER REFERENCES wards(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_communities_ward ON communities(ward_id)`;
  console.log("  ✓ wards table + community.ward_id");

  // ── Feeds table ────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS feeds (
      id SERIAL PRIMARY KEY,
      user_hash TEXT NOT NULL,
      clerk_user_id TEXT,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
      state_id INTEGER REFERENCES states(id) ON DELETE SET NULL,
      lga_id INTEGER REFERENCES lgas(id) ON DELETE SET NULL,
      ward_id INTEGER REFERENCES wards(id) ON DELETE SET NULL,
      community_id INTEGER REFERENCES communities(id) ON DELETE SET NULL,
      state_name TEXT,
      lga_name TEXT,
      ward_name TEXT,
      community_name TEXT,
      region_name TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      location_source TEXT,
      assignment_confidence INTEGER NOT NULL DEFAULT 0,
      ai_community_prediction JSONB,
      ai_relevance_score INTEGER NOT NULL DEFAULT 50,
      spam_score INTEGER NOT NULL DEFAULT 0,
      spam_verdict TEXT NOT NULL DEFAULT 'clean',
      duplicate_of_id INTEGER REFERENCES feeds(id) ON DELETE SET NULL,
      trust_score INTEGER NOT NULL DEFAULT 50,
      like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_status_created ON feeds(status, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_state ON feeds(state_id) WHERE state_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_lga ON feeds(lga_id) WHERE lga_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_ward ON feeds(ward_id) WHERE ward_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_community ON feeds(community_id) WHERE community_id IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_user ON feeds(user_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_tags ON feeds USING GIN (tags)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feeds_spam ON feeds(spam_verdict) WHERE spam_verdict <> 'clean'`;
  console.log("  ✓ feeds table + indexes");

  // ── Optional PostGIS ────────────────────────────────────────────────────
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
    await sql`ALTER TABLE feeds ADD COLUMN IF NOT EXISTS geog geography(Point, 4326)`;
    await sql`UPDATE feeds SET geog = ST_MakePoint(COALESCE(lng, 0), COALESCE(lat, 0))::geography WHERE geog IS NULL AND lat IS NOT NULL AND lng IS NOT NULL`;
    await sql`CREATE INDEX IF NOT EXISTS idx_feeds_geog ON feeds USING GIST (geog) WHERE geog IS NOT NULL`;
    console.log("  ✓ PostGIS geography column + GiST index");
  } catch (err) {
    console.warn("  ⚠ PostGIS unavailable on this branch — nearby queries will use Haversine fallback.", err?.message);
  }

  // ── Seed sample wards ───────────────────────────────────────────────────
  const wardCount = (await sql`SELECT COUNT(*)::int AS c FROM wards`)[0]?.c ?? 0;
  if (wardCount === 0) {
    const sample = [
      ["Lagos", "Ikeja", "Oke-Ira", 6.6018, 3.3515], ["Lagos", "Ikeja", "Alausa", 6.6030, 3.3540],
      ["Lagos", "Surulere", "Itire", 6.5244, 3.3503], ["Lagos", "Surulere", "Iponri", 6.5100, 3.3600],
      ["Lagos", "Ikorodu", "Ijede", 6.6167, 3.6833], ["Lagos", "Eti-Osa", "Ikoyi-Obalende", 6.4500, 3.4350],
      ["Rivers", "Port Harcourt", "D-Line", 4.8156, 7.0498], ["Rivers", "Port Harcourt", "Town", 4.7684, 7.0147],
      ["Rivers", "Obio-Akpor", "Rumuolumeni", 4.8300, 6.9800],
      ["Enugu", "Enugu East", "Abakpa", 6.4700, 7.5100], ["Enugu", "Enugu North", "Ogui", 6.4600, 7.4900],
      ["Kano", "Kano Municipal", "Fagge", 12.0200, 8.5400], ["Kano", "Nasarawa", "Kofar Wambai", 12.0100, 8.5200],
      ["Kaduna", "Kaduna North", "Kawo", 10.6300, 7.4500], ["Kaduna", "Zaria", "Tudun Wada", 11.0800, 7.6900],
      ["FCT", "Municipal Area Council", "Wuse", 9.0800, 7.4700], ["FCT", "Municipal Area Council", "Garki", 9.0200, 7.4900],
      ["Oyo", "Ibadan North", "Bodija", 7.4300, 3.9100], ["Oyo", "Ibadan North", "Agodi", 7.4200, 3.9000],
      ["Ogun", "Abeokuta South", "Ijemo", 7.1500, 3.3700],
    ];
    for (const [stateName, lgaName, wardName, lat, lng] of sample) {
      const st = await sql`SELECT id FROM states WHERE name = ${stateName}`;
      const stateId = st[0]?.id;
      if (!stateId) continue;
      const lg = await sql`SELECT id FROM lgas WHERE name = ${lgaName} AND state_id = ${stateId} LIMIT 1`;
      const lgaId = lg[0]?.id;
      if (!lgaId) continue;
      const code = `${stateName.slice(0, 2)}/${lgaName.slice(0, 2)}/${wardName.slice(0, 2)}`.toUpperCase();
      await sql`INSERT INTO wards (name, code, state_id, lga_id, lat, lng, source) VALUES (${wardName}, ${code}, ${stateId}, ${lgaId}, ${lat}, ${lng}, 'sample') ON CONFLICT (lga_id, name) DO NOTHING`;
    }
    console.log("  ✓ sample wards seeded");
  } else {
    console.log(`  • wards already populated (${wardCount} rows) — skipping seed`);
  }

  // ── Schema version marker ────────────────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`INSERT INTO schema_migrations (version) VALUES (${SCHEMA_VERSION}) ON CONFLICT (version) DO UPDATE SET version = EXCLUDED.version`;
  console.log(`  ✓ schema_migrations → ${SCHEMA_VERSION}`);

  console.log("✓ Community Feeds migration complete.");
}

run().catch((err) => {
  console.error("✗ Migration failed:", err);
  process.exit(1);
});
