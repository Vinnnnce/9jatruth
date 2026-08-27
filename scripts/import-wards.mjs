/**
 * Bulk ward + community importer for the Community Feeds system.
 * ─────────────────────────────────────────────────────────────────────────
 * Loads an authoritative Nigerian ward/community dataset from a CSV file into
 * the `wards` (+ optionally `communities`) tables. Use this to go from the
 * sample seed to full INEC ward coverage (~8,809 wards).
 *
 * CSV format (header row required, case-insensitive column names):
 *   state,lga,ward,community,lat,lng
 *   Lagos,Ikeja,Oke-Ira,,6.6018,3.3515
 *   Lagos,Ikeja,Oke-Ira,Ikeja GRA,6.6018,3.3515
 *
 * `community`, `lat`, `lng` are optional. Wards are de-duplicated by (lga, name).
 * States/LGAs are auto-created if missing (matched against the static list).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/import-wards.mjs data/nigeria-wards.csv
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set.");
  process.exit(1);
}
const csvPath = process.argv[2];
if (!csvPath || !existsSync(csvPath)) {
  console.error("✗ Usage: node scripts/import-wards.mjs <wards.csv>");
  console.error("  CSV columns: state,lga,ward,community,lat,lng");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim());
  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => (row[h] = (cells[idx] ?? "").trim()));
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function ensureStateLga(stateName, lgaName) {
  let stateId;
  const st = await sql`SELECT id FROM states WHERE name ILIKE ${stateName} LIMIT 1`;
  if (st.length === 0) {
    const ins = await sql`INSERT INTO states (name) VALUES (${stateName}) RETURNING id`;
    stateId = ins[0]?.id;
  } else {
    stateId = st[0].id;
  }
  let lgaId;
  const lg = await sql`SELECT id FROM lgas WHERE name ILIKE ${lgaName} AND state_id = ${stateId} LIMIT 1`;
  if (lg.length === 0) {
    const ins = await sql`INSERT INTO lgas (name, state_id) VALUES (${lgaName}, ${stateId}) RETURNING id`;
    lgaId = ins[0]?.id;
  } else {
    lgaId = lg[0].id;
  }
  return { stateId, lgaId };
}

async function run() {
  const text = readFileSync(csvPath, "utf8");
  const rows = parseCsv(text);
  console.log(`→ Importing ${rows.length} rows from ${csvPath}…`);

  let wardsInserted = 0;
  let communitiesInserted = 0;
  const wardCache = new Map(); // `${lgaId}|${wardName}` -> wardId

  for (const row of rows) {
    const stateName = (row.state || "").trim();
    const lgaName = (row.lga || "").trim();
    const wardName = (row.ward || "").trim();
    if (!stateName || !lgaName || !wardName) continue;

    const { stateId, lgaId } = await ensureStateLga(stateName, lgaName);
    const cacheKey = `${lgaId}|${wardName.toLowerCase()}`;

    let wardId = wardCache.get(cacheKey);
    if (!wardId) {
      const existing = await sql`SELECT id FROM wards WHERE lga_id = ${lgaId} AND name ILIKE ${wardName} LIMIT 1`;
      if (existing.length > 0) {
        wardId = existing[0].id;
      } else {
        const lat = row.lat ? parseFloat(row.lat) : null;
        const lng = row.lng ? parseFloat(row.lng) : null;
        const code = `${stateName.slice(0, 2)}/${lgaName.slice(0, 2)}/${wardName.slice(0, 2)}`.toUpperCase();
        const ins = await sql`INSERT INTO wards (name, code, state_id, lga_id, lat, lng, source) VALUES (${wardName}, ${code}, ${stateId}, ${lgaId}, ${lat}, ${lng}, 'import') ON CONFLICT (lga_id, name) DO NOTHING RETURNING id`;
        wardId = ins[0]?.id;
        if (wardId) wardsInserted++;
      }
      if (wardId) wardCache.set(cacheKey, wardId);
    }

    // Optional community row.
    const communityName = (row.community || "").trim();
    if (communityName && wardId) {
      const lat = row.lat ? parseFloat(row.lat) : 0;
      const lng = row.lng ? parseFloat(row.lng) : 0;
      const geoHash = `${stateName.slice(0, 2)}_${lgaName.slice(0, 2)}_${communityName.slice(0, 2)}`.toLowerCase();
      try {
        const c = await sql`INSERT INTO communities (name, ward_id, geo_hash, lat, lng) VALUES (${communityName}, ${wardId}, ${geoHash}, ${lat}, ${lng}) ON CONFLICT DO NOTHING RETURNING id`;
        if (c[0]?.id) communitiesInserted++;
      } catch {
        // community may already exist with a village_id — skip on conflict.
      }
    }
  }

  console.log(`✓ Import complete: ${wardsInserted} wards, ${communitiesInserted} communities added.`);
  const totals = await sql`SELECT (SELECT COUNT(*) FROM wards) AS wards, (SELECT COUNT(*) FROM communities) AS communities`;
  console.log(`  Totals → wards: ${totals[0].wards}, communities: ${totals[0].communities}`);
}

run().catch((err) => {
  console.error("✗ Import failed:", err);
  process.exit(1);
});
