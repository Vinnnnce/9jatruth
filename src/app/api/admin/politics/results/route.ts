import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * Admin: Results management.
 * POST /api/admin/politics/results — Create/update a single result
 * POST /api/admin/politics/results/import — Bulk import from CSV (JSON body)
 * POST /api/admin/politics/results/[id]/status — Update result status
 *
 * GET  /api/admin/politics/results — List results for admin
 */
export const dynamic = "force-dynamic";

const resultSchema = z.object({
  election_id: z.number().int().positive(),
  position_id: z.number().int().optional(),
  party_acronym: z.string().optional(),
  candidate_name: z.string().optional(),
  candidate_id: z.number().int().optional(),
  votes: z.number().int().default(0),
  geo_level: z.enum(["national", "state", "lga", "ward", "polling_unit"]),
  state_id: z.number().int().optional(),
  lga_id: z.number().int().optional(),
  ward_id: z.number().int().optional(),
  polling_unit_id: z.number().int().optional(),
  total_registered_voters: z.number().int().optional(),
  total_accredited_voters: z.number().int().optional(),
  total_valid_votes: z.number().int().optional(),
  total_rejected_votes: z.number().int().optional(),
  total_votes_cast: z.number().int().optional(),
  result_type: z.string().default("official"),
  status: z.string().default("pending"),
  source_url: z.string().optional(),
  declared_at: z.string().optional(),
});

export async function GET(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("election_id");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);

  const rows = (await sql`
    SELECT r.*, pp.name AS position_name, p.name AS party_name, p.color AS party_color,
           s.name AS state_name, l.name AS lga_name, w.name AS ward_name
    FROM election_results r
    LEFT JOIN political_positions pp ON pp.id = r.position_id
    LEFT JOIN political_parties p ON p.acronym = r.party_acronym
    LEFT JOIN states s ON s.id = r.state_id
    LEFT JOIN lgas l ON l.id = r.lga_id
    LEFT JOIN wards w ON w.id = r.ward_id
    WHERE (${electionId ?? null}::int IS NULL OR r.election_id = ${electionId ?? null}::int)
      AND (${status ?? null}::text IS NULL OR r.status = ${status ?? null})
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `) as unknown as any[];
  return Response.json({ results: rows, total: rows.length });
}

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid result data", errors: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const sql = getDb();
  const result = ((await sql`
    INSERT INTO election_results (election_id, position_id, party_acronym, candidate_name, candidate_id, votes, geo_level, state_id, lga_id, ward_id, polling_unit_id, total_registered_voters, total_accredited_voters, total_valid_votes, total_rejected_votes, total_votes_cast, result_type, status, source_url, declared_at)
    VALUES (${d.election_id}, ${d.position_id || null}, ${d.party_acronym || null}, ${d.candidate_name || null}, ${d.candidate_id || null}, ${d.votes}, ${d.geo_level}, ${d.state_id || null}, ${d.lga_id || null}, ${d.ward_id || null}, ${d.polling_unit_id || null}, ${d.total_registered_voters || null}, ${d.total_accredited_voters || null}, ${d.total_valid_votes || null}, ${d.total_rejected_votes || null}, ${d.total_votes_cast || null}, ${d.result_type}, ${d.status}, ${d.source_url || null}, ${d.declared_at || null})
    RETURNING *
  `) as unknown as any[])[0];
  return Response.json({ result });
}
