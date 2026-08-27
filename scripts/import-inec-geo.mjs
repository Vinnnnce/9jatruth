#!/usr/bin/env node
// Standalone INEC geo importer: node scripts/import-inec-geo.mjs
// Reads data/inec-geo/*.json and upserts 37 states, 774 LGAs, 8,809 wards with
// official INEC codes into the Neon database. Requires DATABASE_URL in env.
import { neon } from "@neondatabase/serverless";
import { importInecGeo } from "../src/lib/inec-geo-import.ts";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is required. Export it from Neon / Vercel and re-run.");
  process.exit(1);
}
const sql = neon(dbUrl);
console.log("[inec-geo] importing official electoral geography…");
const result = await importInecGeo(sql, (m) => console.log("[inec-geo]", m));
console.log("[inec-geo] DONE:", JSON.stringify(result));
