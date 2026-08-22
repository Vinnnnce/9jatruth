import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
const env = readFileSync(".env.vercel","utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g,"");
const sql = neon(url);

// 1. Add missing columns
await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS user_hash TEXT`;
await sql`CREATE INDEX IF NOT EXISTS idx_platform_users_user_hash ON platform_users(user_hash)`;
await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS username TEXT`;
console.log("Columns added.");

// 2. Backfill user_hash for existing platform_users (dev_ + sha256(clerk_user_id).substring(0,12))
import crypto from "crypto";
const users = await sql`SELECT id, clerk_user_id FROM platform_users WHERE clerk_user_id IS NOT NULL`;
for (const u of users) {
  const hash = crypto.createHash("sha256").update(u.clerk_user_id).digest("hex").substring(0, 12);
  const userHash = `dev_${hash}`;
  await sql`UPDATE platform_users SET user_hash = ${userHash} WHERE id = ${u.id}`;
  console.log(`user ${u.id} -> ${userHash}`);
}
console.log("Backfill complete. rows:", users.length);
