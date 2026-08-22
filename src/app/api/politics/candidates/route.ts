import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * Political candidates.
 * GET  /api/politics/candidates?party=&office=&geo_id=&year=  → list/filter
 * POST /api/politics/candidates                              → super-admin create/update
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const party = searchParams.get("party");
  const office = searchParams.get("office");
  const geoId = searchParams.get("geo_id");
  const year = searchParams.get("year");

  const sql = getDb();
  const rows = (await sql`
    SELECT c.*, p.name AS party_name, p.color AS party_color
    FROM political_candidates c
    LEFT JOIN political_parties p ON c.party_acronym = p.acronym
    WHERE (${party ?? null}::text IS NULL OR c.party_acronym = ${party ?? null})
      AND (${office ?? null}::text IS NULL OR c.office = ${office ?? null})
      AND (${geoId ?? null}::text IS NULL OR c.geo_id = ${geoId ?? null})
      AND (${year ?? null}::int IS NULL OR c.election_year = ${year ?? null})
    ORDER BY c.election_year DESC NULLS LAST, c.name
  `) as unknown as any[];
  return Response.json({ candidates: rows });
}

const candidateSchema = z.object({
  name: z.string().min(2).max(200),
  party_acronym: z.string().max(12).optional().nullable(),
  office: z.enum(["presidential", "governor", "senate", "house", "other"]),
  geo_id: z.string().max(20).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  election_year: z.number().int().min(1999).max(2030).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  photo_url: z.string().url().or(z.literal("")).optional().nullable(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = candidateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid candidate", errors: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const sql = getDb();
  const inserted = (await sql`
    INSERT INTO political_candidates (name, party_acronym, office, geo_id, state, election_year, bio, photo_url)
    VALUES (${d.name}, ${d.party_acronym ?? null}, ${d.office}, ${d.geo_id ?? null}, ${d.state ?? null}, ${d.election_year ?? null}, ${d.bio ?? null}, ${d.photo_url ?? null})
    RETURNING *
  `) as unknown as any[];
  return Response.json({ candidate: inserted[0] });
}
