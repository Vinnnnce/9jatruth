#!/usr/bin/env node
/**
 * Standalone, idempotent importer for Nigeria INEC polling units.
 * Data source: github.com/saidiadegoke/nigeria-inec-geo (polling-units.csv)
 * Committed under scripts/data/inec-geo/polling-units.csv
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/import-polling-units.mjs
 *   DATABASE_URL=... node scripts/import-polling-units.mjs --state=01      # one state
 *   DATABASE_URL=... node scripts/import-polling-units.mjs --batch=1000    # custom batch size
 *   DATABASE_URL=... node scripts/import-polling-units.mjs --dry-run       # preview only
 *
 * Safe to re-run — uses ON CONFLICT (ward_id, pu_code) DO UPDATE.
 * Creates the geo_polling_units table if missing.
 * Uses batched multi-value INSERTs so 176,846 PUs import in ~354 HTTP calls (500/batch).
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync, createReadStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = resolve(__dirname, "data/inec-geo/polling-units.csv");

// Parse CLI args
const args = process.argv.slice(2);
const stateFilter = args.find((a) => a.startsWith("--state="))?.split("=")[1];
const batchSize = parseInt(args.find((a) => a.startsWith("--batch="))?.split("=")[1] || "500", 10);
const dryRun = args.includes("--dry-run");

async function main() {
  if (!process.env.DATABASE_URL && !dryRun) {
    console.error("Error: DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = dryRun ? null : neon(process.env.DATABASE_URL);

  // Ensure the table exists
  if (sql) {
    await sql`CREATE TABLE IF NOT EXISTS geo_polling_units (
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
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pu_state ON geo_polling_units(state_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pu_lga ON geo_polling_units(lga_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pu_ward ON geo_polling_units(ward_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pu_code ON geo_polling_units(code)`;
    console.log("Table ensured.");
  }

  // Build lookup maps from existing geo data
  console.log("Building lookup maps...");
  const states = (await sql`SELECT id, code FROM states WHERE code IS NOT NULL`) || [];
  const stateByCode = new Map();
  for (const s of states) stateByCode.set(s.code, s.id);

  const lgas = (await sql`SELECT id, code, state_id FROM lgas WHERE code IS NOT NULL`) || [];
  // Key: state_code + lga_code → lga_id
  const lgaByKey = new Map();
  for (const l of lgas) {
    const stateCode = states.find((s) => s.id === l.state_id)?.code;
    if (stateCode) lgaByKey.set(`${stateCode}/${l.code}`, l.id);
  }

  const wards = (await sql`SELECT id, code, lga_id FROM wards`) || [];
  // Key: lga_id + ward_code → ward_id
  const wardByKey = new Map();
  for (const w of wards) {
    wardByKey.set(`${w.lga_id}/${w.code}`, w.id);
  }

  console.log(`Lookups: ${stateByCode.size} states, ${lgaByKey.size} LGAs, ${wardByKey.size} wards`);

  // Parse CSV and build rows
  console.log("Parsing polling-units.csv...");
  const rows = [];
  let skipped = 0;
  let lineNum = 0;

  const rl = createInterface({ input: createReadStream(DATA_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    lineNum++;
    if (lineNum === 1) continue; // skip header

    // Simple CSV parse (no quoted commas expected in INEC data)
    const cols = line.split(",");
    if (cols.length < 11) { skipped++; continue; }

    const [stateCode, stateName, lgaCode, lgaName, wardCode, wardName, puCode, puName, puLocation, fullCode, portalId] = cols;

    // Filter by state if specified
    if (stateFilter && stateCode !== stateFilter) continue;

    const stateId = stateByCode.get(stateCode);
    if (!stateId) { skipped++; continue; }

    const lgaId = lgaByKey.get(`${stateCode}/${lgaCode}`);
    if (!lgaId) { skipped++; continue; }

    const wardId = wardByKey.get(`${lgaId}/${wardCode}`);
    if (!wardId) { skipped++; continue; }

    rows.push([
      fullCode,      // code
      stateCode,     // state_code
      stateId,       // state_id
      lgaCode,       // lga_code
      lgaId,         // lga_id
      wardCode,      // ward_code
      wardId,        // ward_id
      puCode,        // pu_code
      puName,        // name
      puLocation || null, // location
      parseInt(portalId, 10) || null, // portal_id
    ]);
  }

  console.log(`Parsed ${rows.length} polling units (${skipped} skipped/unmatched)`);

  if (dryRun) {
    console.log("[DRY RUN] No data written.");
    console.log(`First 3 rows:`, rows.slice(0, 3));
    process.exit(0);
  }

  // Batch insert
  function chunkArr(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  let inserted = 0;
  const chunks = chunkArr(rows, batchSize);
  console.log(`Inserting ${rows.length} rows in ${chunks.length} batches of ${batchSize}...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const tuples = [];
    const params = [];
    let p = 1;
    for (const row of chunk) {
      const ph = row.map(() => `$${p++}`).join(", ");
      tuples.push(`(${ph}, 'INEC', NOW())`);
      params.push(...row);
    }
    const query = `INSERT INTO geo_polling_units (code, state_code, state_id, lga_code, lga_id, ward_code, ward_id, pu_code, name, location, portal_id, source, source_updated_at) VALUES ${tuples.join(", ")} ON CONFLICT (ward_id, pu_code) DO UPDATE SET code = EXCLUDED.code, state_code = EXCLUDED.state_code, state_id = EXCLUDED.state_id, lga_code = EXCLUDED.lga_code, lga_id = EXCLUDED.lga_id, ward_code = EXCLUDED.ward_code, name = EXCLUDED.name, location = EXCLUDED.location, portal_id = EXCLUDED.portal_id, source = EXCLUDED.source, source_updated_at = EXCLUDED.source_updated_at`;
    await sql.query(query, params);
    inserted += chunk.length;
    if ((i + 1) % 20 === 0 || i === chunks.length - 1) {
      console.log(`  Batch ${i + 1}/${chunks.length} — ${inserted}/${rows.length} inserted`);
    }
  }

  // Verify
  const count = (await sql`SELECT COUNT(*) c FROM geo_polling_units`)[0];
  console.log(`\nDone! Total polling units in database: ${count.c}`);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
