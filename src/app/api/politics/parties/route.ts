import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getParties as fetchNigeria2Parties } from "@/lib/nigeria2";
import { z } from "zod";

/**
 * Political parties.
 * GET  /api/politics/parties        → list parties (auto-synced from Nigeria2 if DB empty)
 * POST /api/politics/parties        → super-admin create/update a party
 */
export async function GET() {
  try {
  await ensureDbInitialized();
  const sql = getDb();
  let rows = (await sql`SELECT * FROM political_parties ORDER BY acronym`) as unknown as any[];
  // Lazily seed from Nigeria2 on first access.
  if (rows.length === 0) {
    try {
      const { parties } = await fetchNigeria2Parties(true);
      if (parties && parties.length > 0) {
        for (const p of parties) {
          await sql`INSERT INTO political_parties (acronym, name, active)
            VALUES (${p.acronym}, ${p.name}, ${p.active !== false})
            ON CONFLICT (acronym) DO NOTHING`;
        }
        rows = (await sql`SELECT * FROM political_parties ORDER BY acronym`) as unknown as any[];
      }
    } catch (err) {
      console.error("[politics/parties] Nigeria2 sync failed:", err);
    }
  }
  return Response.json({ parties: rows });
  } catch (err: any) {
    console.error("[politics/parties] GET failed:", err);
    return Response.json({ message: "Failed to load parties" }, { status: 500 });
  }
}

const partySchema = z.object({
  acronym: z.string().min(1).max(12).toUpperCase(),
  name: z.string().min(2).max(200),
  color: z.string().max(20).optional(),
  logo_url: z.string().url().optional().or(z.literal("")).optional(),
  active: z.boolean().optional(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = partySchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid party", errors: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const sql = getDb();
  const inserted = (await sql`
    INSERT INTO political_parties (acronym, name, color, logo_url, active)
    VALUES (${d.acronym}, ${d.name}, ${d.color ?? null}, ${d.logo_url || null}, ${d.active ?? true})
    ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, logo_url = EXCLUDED.logo_url, active = EXCLUDED.active
    RETURNING *
  `) as unknown as any[];
  return Response.json({ party: inserted[0] });
}
