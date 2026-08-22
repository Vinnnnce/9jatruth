import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envText = readFileSync(".env.vercel", "utf8");
const DATABASE_URL = envText.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
const sql = neon(DATABASE_URL);

try {
  const rows = await sql`SELECT t.*, o.name as org_name, o.verified as org_verified, n.name as neighborhood_name, u.display_name, u.username FROM micro_truths t LEFT JOIN organizations o ON t.organization_id = o.id LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id LEFT JOIN platform_users u ON t.user_hash = u.user_hash ORDER BY t.created_at DESC LIMIT 5`;
  console.log("row count:", rows.length);
  console.log("row[0] keys:", Object.keys(rows[0]).join(", "));
  const mapped = rows.map((r) => ({
    id: r.id,
    neighborhoodId: r.neighborhood_id,
    category: r.category,
    content: r.content,
    trustScore: r.trust_score,
    decayFactor: r.decay_factor,
    verificationChain: r.verification_chain,
    userHash: r.user_hash,
    displayName: r.display_name ?? r.username ?? null,
    status: r.status,
    createdAt: r.created_at,
    organizationId: r.organization_id ?? null,
    stateName: r.state_name ?? null,
    lgaName: r.lga_name ?? null,
    orgName: r.org_name ?? null,
    orgVerified: r.org_verified === 1 || r.org_verified === true,
    neighborhoodName: r.neighborhood_name ?? null,
  }));
  console.log("mapped[0]:", JSON.stringify(mapped[0]).slice(0, 300));
  // Now test JSON serialization (what Response.json does)
  const jsonStr = JSON.stringify(mapped);
  console.log("JSON length:", jsonStr.length);
  console.log("OK — no error");
} catch (e) {
  console.error("ERROR:", e.message);
  console.error(e.stack);
}
