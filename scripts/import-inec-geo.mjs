#!/usr/bin/env node
/**
 * Standalone, idempotent importer for Nigeria INEC electoral geography.
 * Data source: github.com/saidiadegoke/nigeria-inec-geo (committed under scripts/data/inec-geo/).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/import-inec-geo.mjs
 *   DATABASE_URL=... node scripts/import-inec-geo.mjs --state=01      # one state (by INEC code)
 *   DATABASE_URL=... node scripts/import-inec-geo.mjs --reference     # positions/parties/elections only
 *
 * Safe to re-run — uses ON CONFLICT upserts. Creates the geo tables if missing.
 * Uses batched multi-value INSERTs (sql.query) so 8809 wards import in ~25 HTTP calls.
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "data/inec-geo");

const ZONES = [
  { code: "NC", name: "North Central", slug: "north-central" },
  { code: "NE", name: "North East", slug: "north-east" },
  { code: "NW", name: "North West", slug: "north-west" },
  { code: "SE", name: "South East", slug: "south-east" },
  { code: "SS", name: "South South", slug: "south-south" },
  { code: "SW", name: "South West", slug: "south-west" },
];

const STATE_ZONE = {
  ABIA: "SE", ANAMBRA: "SE", EBONYI: "SE", ENUGU: "SE", IMO: "SE",
  AKWA: "SS", BAYELSA: "SS", CROSS: "SS", DELTA: "SS", EDO: "SS", RIVERS: "SS",
  EKITI: "SW", LAGOS: "SW", OGUN: "SW", ONDO: "SW", OSUN: "SW", OYO: "SW",
  ADAMAWA: "NE", BAUCHI: "NE", BORNO: "NE", GOMBE: "NE", TARABA: "NE", YOBE: "NE",
  JIGAWA: "NW", KADUNA: "NW", KANO: "NW", KATSINA: "NW", KEBBI: "NW", SOKOTO: "NW", ZAMFARA: "NW",
  BENUE: "NC", KOJI: "NC", KOGI: "NC", NASARAWA: "NC", PLATEAU: "NC",
  NIGER: "NW", FCT: "NC", "FEDERAL CAPITAL TERRITORY": "NC", ABUJA: "NC",
};
const zoneFor = (name) => {
  const u = name.toUpperCase().trim();
  if (STATE_ZONE[u]) return STATE_ZONE[u];
  if (u.startsWith("CROSS")) return "SS";
  if (u.startsWith("AKWA")) return "SS";
  return "NC";
};

const POSITIONS = [
  { code: "president", name: "President", level: "federal", sort_order: 0 },
  { code: "vice_president", name: "Vice President", level: "federal", sort_order: 1 },
  { code: "senator", name: "Senator", level: "federal", sort_order: 2 },
  { code: "house_of_rep", name: "House of Representatives Member", level: "federal", sort_order: 3 },
  { code: "governor", name: "State Governor", level: "state", sort_order: 4 },
  { code: "deputy_governor", name: "Deputy Governor", level: "state", sort_order: 5 },
  { code: "state_assembly", name: "State House of Assembly Member", level: "state", sort_order: 6 },
  { code: "lga_chairman", name: "LGA Chairman", level: "lga", sort_order: 7 },
  { code: "councillor", name: "Ward Councillor", level: "lga", sort_order: 8 },
];
const PARTIES = [
  { acronym: "APC", name: "All Progressives Congress", color: "#006633" },
  { acronym: "PDP", name: "Peoples Democratic Party", color: "#1a5276" },
  { acronym: "LP", name: "Labour Party", color: "#c0392b" },
  { acronym: "NNPP", name: "New Nigeria Peoples Party", color: "#d35400" },
  { acronym: "APGA", name: "All Progressives Grand Alliance", color: "#27ae60" },
  { acronym: "SDP", name: "Social Democratic Party", color: "#2980b9" },
  { acronym: "ADC", name: "African Democratic Congress", color: "#8e44ad" },
  { acronym: "ADP", name: "Action Democratic Party", color: "#16a085" },
  { acronym: "AAC", name: "African Action Congress", color: "#7f8c8d" },
  { acronym: "NRM", name: "National Rescue Movement", color: "#34495e" },
  { acronym: "YPP", name: "Young Progressives Party", color: "#f1c40f" },
  { acronym: "APP", name: "Action Peoples Party", color: "#2c3e50" },
  { acronym: "ZLP", name: "Zenith Labour Party", color: "#e67e22" },
];
const ELECTIONS = [
  { year: 2027, name: "2027 Nigerian General Election", type: "general", geo_scope: "national", election_date: "2027-02-18", status: "upcoming" },
];

// Split an array into chunks of size n.
function chunkArr(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Build a parameterized multi-value INSERT. `rows` is an array of arrays (each = column values in `columns` order).
// `suffix` is e.g. " ON CONFLICT DO NOTHING". Returns { sql, params } for sql.query(sql, params).
// Source ('INEC') and source_updated_at (NOW()) are appended as literals to every row.
function multiInsert(table, columns, rows, suffix) {
  const cols = columns.join(", ");
  const tuples = [];
  const params = [];
  let i = 1;
  for (const row of rows) {
    const ph = row.map(() => `$${i++}`).join(", ");
    tuples.push(`(${ph}, 'INEC', NOW())`);
    params.push(...row);
  }
  return { sql: `INSERT INTO ${table} (${cols}, source, source_updated_at) VALUES ${tuples.join(", ")}${suffix}`, params };
}

async function ensureGeoTables(sql) {
  const ddls = [
    `CREATE TABLE IF NOT EXISTS regions (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, code TEXT, slug TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS states (id SERIAL PRIMARY KEY, name TEXT NOT NULL, region_id INTEGER, code TEXT, portal_id INTEGER, lat DOUBLE PRECISION, lng DOUBLE PRECISION, source TEXT, source_updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS lgas (id SERIAL PRIMARY KEY, name TEXT NOT NULL, state_id INTEGER, code TEXT, portal_id INTEGER, lat DOUBLE PRECISION, lng DOUBLE PRECISION, source TEXT, source_updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS wards (id SERIAL PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, lga_id INTEGER NOT NULL REFERENCES lgas(id) ON DELETE CASCADE, state_id INTEGER NOT NULL REFERENCES states(id) ON DELETE CASCADE, portal_id INTEGER, lat DOUBLE PRECISION, lng DOUBLE PRECISION, source TEXT, source_updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (lga_id, code, name))`,
    `CREATE TABLE IF NOT EXISTS political_positions (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'federal', sort_order INTEGER NOT NULL DEFAULT 99, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS political_parties (id SERIAL PRIMARY KEY, acronym TEXT NOT NULL UNIQUE, name TEXT NOT NULL, color TEXT, logo_url TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS political_elections (id SERIAL PRIMARY KEY, year INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'general', geo_scope TEXT NOT NULL DEFAULT 'national', election_date DATE, status TEXT NOT NULL DEFAULT 'upcoming', created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (year, type, geo_scope))`,
    // Backfill columns on pre-existing tables (idempotent)
    `ALTER TABLE regions ADD COLUMN IF NOT EXISTS code TEXT`,
    `ALTER TABLE regions ADD COLUMN IF NOT EXISTS slug TEXT`,
    `ALTER TABLE states ADD COLUMN IF NOT EXISTS code TEXT`,
    `ALTER TABLE states ADD COLUMN IF NOT EXISTS portal_id INTEGER`,
    `ALTER TABLE states ADD COLUMN IF NOT EXISTS region_id INTEGER`,
    `ALTER TABLE states ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
    `ALTER TABLE states ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
    `ALTER TABLE states ADD COLUMN IF NOT EXISTS source TEXT`,
    `ALTER TABLE states ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_states_code ON states(code) WHERE code IS NOT NULL`,
    `ALTER TABLE lgas ADD COLUMN IF NOT EXISTS code TEXT`,
    `ALTER TABLE lgas ADD COLUMN IF NOT EXISTS portal_id INTEGER`,
    `ALTER TABLE lgas ADD COLUMN IF NOT EXISTS state_id INTEGER`,
    `ALTER TABLE lgas ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
    `ALTER TABLE lgas ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
    `ALTER TABLE lgas ADD COLUMN IF NOT EXISTS source TEXT`,
    `ALTER TABLE lgas ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_lgas_code ON lgas(code)`,
    `CREATE INDEX IF NOT EXISTS idx_lgas_state ON lgas(state_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wards_lga ON wards(lga_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wards_state ON wards(state_id)`,
    `CREATE INDEX IF NOT EXISTS idx_wards_code ON wards(code)`,
    // Ensure unique constraints exist for ON CONFLICT upserts (pre-existing tables may lack them)
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_regions_name ON regions(name)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_states_name ON states(name)`,
  ];
  for (const ddl of ddls) await sql.query(ddl);
}

async function importGeo(sql, stateFilter) {
  const states = JSON.parse(readFileSync(resolve(DATA_DIR, "states.json"), "utf8"));
  const lgas = JSON.parse(readFileSync(resolve(DATA_DIR, "lgas.json"), "utf8"));
  const wards = JSON.parse(readFileSync(resolve(DATA_DIR, "wards.json"), "utf8"));

  for (const z of ZONES) {
    await sql`INSERT INTO regions (name, code, slug) VALUES (${z.name}, ${z.code}, ${z.slug}) ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code, slug = EXCLUDED.slug`;
  }

  // states: upsert each (37, small) and capture id -> portal_id map
  const stateIdByPortal = new Map();
  let sc = 0;
  for (const s of states) {
    if (stateFilter && s.code !== stateFilter) continue;
    const z = zoneFor(s.name);
    const reg = (await sql`SELECT id FROM regions WHERE code = ${z} LIMIT 1`)[0];
    const ins = (await sql`
      INSERT INTO states (name, code, portal_id, region_id, source, source_updated_at)
      VALUES (${s.name}, ${s.code}, ${parseInt(s.portal_id, 10)}, ${reg?.id ?? null}, 'INEC', NOW())
      ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code, portal_id = EXCLUDED.portal_id, region_id = COALESCE(states.region_id, EXCLUDED.region_id), source = EXCLUDED.source, source_updated_at = EXCLUDED.source_updated_at
      RETURNING id`)[0];
    if (ins?.id) { stateIdByPortal.set(String(s.portal_id), ins.id); sc++; }
  }

  // lgas: batch multi-value upsert, then read back id -> portal_id
  const lgaRows = [];
  for (const l of lgas) {
    const sid = stateIdByPortal.get(String(l.state_portal_id));
    if (!sid) continue;
    lgaRows.push([l.name, l.code, parseInt(l.portal_id, 10), sid]);
  }
  for (const chunk of chunkArr(lgaRows, 500)) {
    const mi = multiInsert("lgas", ["name", "code", "portal_id", "state_id"], chunk, " ON CONFLICT (portal_id, state_id) DO NOTHING");
    await sql.query(mi.sql, mi.params);
  }
  const lgaBack = await sql`SELECT id, portal_id FROM lgas WHERE portal_id IS NOT NULL`;
  const lgaIdByPortal = new Map();
  let lc = 0;
  for (const row of lgaBack) { lgaIdByPortal.set(String(row.portal_id), row.id); lc++; }

  // wards: batch multi-value upsert (8809 rows -> ~18 calls)
  const wardRows = [];
  for (const w of wards) {
    const lid = lgaIdByPortal.get(String(w.lga_portal_id));
    const sid = stateIdByPortal.get(String(w.state_portal_id));
    if (!lid || !sid) continue;
    wardRows.push([w.code, w.name, lid, sid, parseInt(w.portal_id, 10)]);
  }
  let wc = 0;
  for (const chunk of chunkArr(wardRows, 500)) {
    const mi = multiInsert("wards", ["code", "name", "lga_id", "state_id", "portal_id"], chunk,
      " ON CONFLICT (lga_id, code, name) DO UPDATE SET portal_id = EXCLUDED.portal_id, source = EXCLUDED.source, source_updated_at = EXCLUDED.source_updated_at");
    await sql.query(mi.sql, mi.params);
    wc += chunk.length;
  }
  return { states: sc, lgas: lc, wards: wc, zones: ZONES.length };
}

async function importReference(sql) {
  let positions = 0, parties = 0, elections = 0;
  for (const p of POSITIONS) { await sql`INSERT INTO political_positions (code, name, level, sort_order) VALUES (${p.code}, ${p.name}, ${p.level}, ${p.sort_order}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, level = EXCLUDED.level, sort_order = EXCLUDED.sort_order`; positions++; }
  for (const p of PARTIES) { await sql`INSERT INTO political_parties (acronym, name, color) VALUES (${p.acronym}, ${p.name}, ${p.color}) ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color`; parties++; }
  for (const e of ELECTIONS) { await sql`INSERT INTO political_elections (year, name, type, geo_scope, election_date, status) VALUES (${e.year}, ${e.name}, ${e.type}, ${e.geo_scope}, ${e.election_date}, ${e.status}) ON CONFLICT (year, type, geo_scope) DO UPDATE SET name = EXCLUDED.name, election_date = EXCLUDED.election_date, status = EXCLUDED.status`; elections++; }
  return { positions, parties, elections };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL is not set."); process.exit(1); }
  if (!existsSync(resolve(DATA_DIR, "states.json"))) { console.error("Missing data dir:", DATA_DIR); process.exit(1); }
  const sql = neon(url);
  const args = process.argv.slice(2);
  const stateArg = args.find((a) => a.startsWith("--state="))?.split("=")[1];
  const referenceOnly = args.includes("--reference");

  await ensureGeoTables(sql);
  if (referenceOnly) {
    const ref = await importReference(sql);
    console.log("Reference data seeded:", ref);
    return;
  }
  const result = await importGeo(sql, stateArg);
  const ref = await importReference(sql);
  console.log(JSON.stringify({ scope: stateArg ? "state" : "all", stateCode: stateArg ?? null, ...result, reference: ref }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
