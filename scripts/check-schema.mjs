import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
const env = readFileSync(".env.vercel","utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g,"");
const sql = neon(url);

const cols = await sql`SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('platform_users','micro_truths','neighborhoods','organizations') ORDER BY table_name, ordinal_position`;
const byTable = {};
for (const c of cols) { (byTable[c.table_name] ??= []).push(c.column_name); }
for (const t of Object.keys(byTable)) console.log(t + ":", byTable[t].join(", "));

console.log("\n=== row counts ===");
for (const t of ["regions","states","lgas","micro_truths","platform_users","neighborhoods","emergency_contacts","schema_migrations"]) {
  try {
    const r = await sql`SELECT COUNT(*) c FROM ${sql.unsafe(t)}`.catch(()=>null);
    if (r) console.log(t, "=", r[0].c);
    else console.log(t, "= (query failed)");
  } catch(e) { console.log(t, "ERR", e.message.slice(0,60)); }
}
