import { neon } from "@neondatabase/serverless";

const OLD_URL = process.env.OLD_DATABASE_URL || "";
const NEW_URL = process.env.NEW_DATABASE_URL || "";

if (!OLD_URL || !NEW_URL) {
  console.error("Error: Set OLD_DATABASE_URL and NEW_DATABASE_URL environment variables.");
  console.error("Example: OLD_DATABASE_URL=postgresql://... NEW_DATABASE_URL=postgresql://... node migrations/migrate-geo.js");
  process.exit(1);
}

const oldSql = neon(OLD_URL);
const newSql = neon(NEW_URL);

const BATCH_SIZE = 2000;

async function migrate() {
  console.log("Starting geo_polling_units migration...");

  // Get total count from OLD
  const countResult = await oldSql`SELECT COUNT(*) as cnt FROM geo_polling_units`;
  const total = parseInt(countResult[0].cnt);
  console.log(`Total rows to migrate: ${total}`);

  // Check if NEW already has data
  const newCount = await newSql`SELECT COUNT(*) as cnt FROM geo_polling_units`;
  const existing = parseInt(newCount[0].cnt);
  if (existing > 0) {
    console.log(`NEW database already has ${existing} rows. Skipping migration.`);
    return;
  }

  // Get column names
  const cols = await oldSql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'geo_polling_units' AND table_schema = 'public'
    ORDER BY ordinal_position
  `;
  const colNames = cols.map(c => c.column_name);
  console.log(`Columns: ${colNames.join(", ")}`);

  let migrated = 0;
  let offset = 0;

  while (offset < total) {
    const batch = await oldSql`
      SELECT * FROM geo_polling_units 
      ORDER BY id 
      LIMIT ${BATCH_SIZE} OFFSET ${offset}
    `;

    if (batch.length === 0) break;

    // Build batch INSERT
    const values = batch.map((row) => {
      const vals = colNames.map((col) => {
        const v = row[col];
        if (v === null || v === undefined) return "NULL";
        if (v instanceof Date) return `'${v.toISOString()}'`;
        if (typeof v === "number") return String(v);
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        // Escape single quotes
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `(${vals.join(", ")})`;
    });

    // Insert in chunks of 500 to avoid query size limits
    const INSERT_CHUNK = 500;
    for (let i = 0; i < values.length; i += INSERT_CHUNK) {
      const chunk = values.slice(i, i + INSERT_CHUNK);
      const insertSql = `
        INSERT INTO geo_polling_units (${colNames.join(", ")}) 
        VALUES ${chunk.join(", ")} 
        ON CONFLICT (id) DO NOTHING
      `;
      await newSql.query(insertSql);
    }

    migrated += batch.length;
    offset += BATCH_SIZE;
    const pct = ((migrated / total) * 100).toFixed(1);
    console.log(`Migrated ${migrated}/${total} rows (${pct}%)`);

    if (batch.length < BATCH_SIZE) break;
  }

  // Verify
  const finalCount = await newSql`SELECT COUNT(*) as cnt FROM geo_polling_units`;
  console.log(`\nMigration complete! NEW database now has ${finalCount[0].cnt} rows in geo_polling_units.`);
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
