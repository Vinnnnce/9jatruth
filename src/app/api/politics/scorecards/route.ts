import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * Political scorecards (candidate performance metrics).
 * GET  /api/politics/scorecards?candidate_id=
 * POST /api/politics/scorecards  → super-admin upsert a metric
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const candidateId = new URL(request.url).searchParams.get("candidate_id");
  const sql = getDb();
  if (!candidateId) return Response.json({ message: "candidate_id required" }, { status: 400 });
  const rows = (await sql`SELECT * FROM political_scorecards WHERE candidate_id = ${Number(candidateId)} ORDER BY category, metric`) as unknown as any[];
  return Response.json({ scorecards: rows });
}

const schema = z.object({
  candidate_id: z.number().int().positive(),
  category: z.string().min(1).max(60),
  metric: z.string().min(1).max(120),
  score: z.number().int().min(0).max(100),
  source: z.string().max(200).optional().nullable(),
  period: z.string().max(60).optional().nullable(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid scorecard", errors: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const sql = getDb();
  const inserted = (await sql`
    INSERT INTO political_scorecards (candidate_id, category, metric, score, source, period)
    VALUES (${d.candidate_id}, ${d.category}, ${d.metric}, ${d.score}, ${d.source ?? null}, ${d.period ?? null})
    RETURNING *
  `) as unknown as any[];
  return Response.json({ scorecard: inserted[0] });
}
