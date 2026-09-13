#!/usr/bin/env node
/**
 * 9JATRUTH — Neon Database Migration Script
 * 
 * Migrates data from OLD Neon database → NEW Neon database.
 * 
 * Usage:
 *   OLD_DATABASE_URL=postgresql://old... NEW_DATABASE_URL=postgresql://new... node migrations/migrate-data.js
 * 
 * Copies all tables:
 *   - platform_users
 *   - organizations
 *   - micro_truths
 *   - neighborhoods
 *   - snapshots
 *   - news_articles
 *   - news_external
 *   - political_parties
 *   - political_candidates
 *   - political_persons
 *   - office_holders
 *   - political_positions
 *   - states, lgas, wards, regions
 *   - predictions
 *   - reward_ledger
 *   - And all other tables
 * 
 * Validates row counts and foreign keys after migration.
 */

const { neon } = require("@neondatabase/serverless");

const OLD_URL = process.env.OLD_DATABASE_URL;
const NEW_URL = process.env.NEW_DATABASE_URL;

if (!OLD_URL || !NEW_URL) {
  console.error("Error: Set OLD_DATABASE_URL and NEW_DATABASE_URL environment variables");
  process.exit(1);
}

const oldDb = neon(OLD_URL);
const newDb = neon(NEW_URL);

// Tables to migrate in dependency order
const TABLES = [
  // Geo hierarchy (no dependencies)
  "regions",
  "countries",
  "states",
  "lgas",
  "wards",
  "communities",
  // Political (depends on geo)
  "political_parties",
  "political_positions",
  "political_persons",
  "political_candidates",
  "office_holders",
  // Core platform
  "organizations",
  "platform_users",
  "neighborhoods",
  "snapshots",
  "micro_truths",
  "predictions",
  "reward_ledger",
  // News
  "news_articles",
  "news_external",
  // Engagement
  "feed_dislikes",
  "feed_reposts",
  "truth_gifts",
  "verifications",
  "notifications",
  "device_profiles",
  // Audit
  "audit_log",
];

async function getTableColumns(db, tableName) {
  const rows = await db`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = ${tableName}
    ORDER BY ordinal_position
  `;
  return rows.map((r) => r.column_name);
}

async function migrateTable(tableName) {
  console.log(`\n--- Migrating ${tableName} ---`);

  // Get columns from source
  const oldColumns = await getTableColumns(oldDb, tableName);
  if (oldColumns.length === 0) {
    console.log(`  Table ${tableName} not found in source, skipping`);
    return { table: tableName, migrated: 0, skipped: true };
  }

  // Get columns from destination
  const newColumns = await getTableColumns(newDb, tableName);
  if (newColumns.length === 0) {
    console.log(`  Table ${tableName} not found in destination, skipping`);
    return { table: tableName, migrated: 0, skipped: true };
  }

  // Use only columns that exist in both
  const commonCols = oldColumns.filter((c) => newColumns.includes(c));
  if (commonCols.length === 0) {
    console.log(`  No common columns for ${tableName}, skipping`);
    return { table: tableName, migrated: 0, skipped: true };
  }

  // Count source rows
  const countResult = await oldDb`SELECT COUNT(*) as cnt FROM ${oldDb(tableName)}`;
  const sourceCount = parseInt(countResult[0].cnt, 10);
  console.log(`  Source rows: ${sourceCount}`);

  if (sourceCount === 0) {
    console.log(`  No rows to migrate`);
    return { table: tableName, migrated: 0, skipped: false };
  }

  // Fetch all rows from source
  const colList = commonCols.join(", ");
  const rows = await oldDb.query(`SELECT ${colList} FROM ${tableName}`);

  // Insert into destination in batches
  const BATCH_SIZE = 500;
  let migrated = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    for (const row of batch) {
      const values = commonCols.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "number") return val;
        if (typeof val === "boolean") return val;
        if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        // String — escape single quotes
        return `'${String(val).replace(/'/g, "''")}'`;
      });

      const placeholders = values.map((_, idx) => `$${idx + 1}`).join(", ");
      
      try {
        await newDb.query(
          `INSERT INTO ${tableName} (${colList}) VALUES (${placeholders})
           ON CONFLICT DO NOTHING`,
          values
        );
        migrated++;
      } catch (err) {
        // Log but continue — individual row failures shouldn't stop migration
        if (migrated === 0 || migrated % 100 === 0) {
          console.error(`  Error at row ${migrated}: ${err.message?.substring(0, 200)}`);
        }
      }
    }

    console.log(`  Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}`);
  }

  // Validate count
  const destCountResult = await newDb`SELECT COUNT(*) as cnt FROM ${newDb(tableName)}`;
  const destCount = parseInt(destCountResult[0].cnt, 10);

  const status = destCount >= sourceCount ? "OK" : "MISMATCH";
  console.log(`  Migrated: ${migrated}, Source: ${sourceCount}, Destination: ${destCount} [${status}]`);

  return { table: tableName, migrated, sourceCount, destCount, status };
}

async function validateForeignKeys() {
  console.log("\n--- Validating foreign keys ---");

  const fkChecks = [
    { table: "political_candidates", fk: "party_acronym", ref: "political_parties", refCol: "acronym" },
    { table: "office_holders", fk: "person_id", ref: "political_persons", refCol: "id" },
    { table: "office_holders", fk: "position_id", ref: "political_positions", refCol: "id" },
    { table: "micro_truths", fk: "neighborhood_id", ref: "neighborhoods", refCol: "id" },
    { table: "snapshots", fk: "neighborhood_id", ref: "neighborhoods", refCol: "id" },
    { table: "states", fk: "region_id", ref: "regions", refCol: "id" },
    { table: "lgas", fk: "state_id", ref: "states", refCol: "id" },
    { table: "wards", fk: "lga_id", ref: "lgas", refCol: "id" },
  ];

  let allValid = true;

  for (const check of fkChecks) {
    const orphans = await newDb`
      SELECT COUNT(*) as cnt FROM ${newDb(check.table)} t
      WHERE t.${newDb(check.fk)} IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ${newDb(check.ref)} r WHERE r.${newDb(check.refCol)} = t.${newDb(check.fk)}
      )
    `;

    const count = parseInt(orphans[0].cnt, 10);
    const status = count === 0 ? "OK" : "ORPHANED";
    if (count > 0) allValid = false;
    console.log(`  ${check.table}.${check.fk} → ${check.ref}.${check.refCol}: ${count} orphans [${status}]`);
  }

  return allValid;
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  9JATRUTH — Neon Database Migration");
  console.log("═══════════════════════════════════════════════");
  console.log(`Source: ${OLD_URL.substring(0, 40)}...`);
  console.log(`Destination: ${NEW_URL.substring(0, 40)}...`);

  const results = [];

  for (const table of TABLES) {
    try {
      const result = await migrateTable(table);
      results.push(result);
    } catch (err) {
      console.error(`Failed to migrate ${table}:`, err.message);
      results.push({ table, error: err.message, migrated: 0 });
    }
  }

  // Validate foreign keys
  const fkValid = await validateForeignKeys();

  // Summary
  console.log("\n═══════════════════════════════════════════════");
  console.log("  MIGRATION SUMMARY");
  console.log("═══════════════════════════════════════════════");

  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const r of results) {
    if (r.skipped) {
      totalSkipped++;
      console.log(`  ${r.table}: SKIPPED`);
    } else if (r.error) {
      totalFailed++;
      console.log(`  ${r.table}: FAILED (${r.error})`);
    } else {
      totalMigrated += r.migrated || 0;
      console.log(`  ${r.table}: ${r.migrated} rows [${r.status}]`);
    }
  }

  console.log(`\n  Total migrated: ${totalMigrated}`);
  console.log(`  Total skipped: ${totalSkipped}`);
  console.log(`  Total failed: ${totalFailed}`);
  console.log(`  Foreign keys: ${fkValid ? "ALL VALID" : "HAS ORPHANS"}`);
  console.log("═══════════════════════════════════════════════");

  if (!fkValid) {
    console.log("\n⚠️  Some foreign key references are orphaned. Review and fix manually.");
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
