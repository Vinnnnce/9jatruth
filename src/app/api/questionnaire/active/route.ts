import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/questionnaire/active
 *
 * Public endpoint — returns active questionnaires where:
 *   status = 'active'
 *   effective expiry (expires_at, falling back to created_at + 24h) is in the future
 *
 * Each questionnaire has its questions array parsed from JSON and an
 * `expiresAt` field that the countdown badge can always rely on.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();
    const sql = getDb();

    const rows = (await sql`
      SELECT *,
             COALESCE(expires_at, created_at + INTERVAL '24 hours') AS effective_expires_at
      FROM questionnaires
      WHERE status = 'active'
        AND COALESCE(expires_at, created_at + INTERVAL '24 hours') > NOW()
      ORDER BY created_at DESC
    `) as unknown as any[];

    const questionnaires = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      questions: r.questions ? JSON.parse(r.questions) : [],
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      expiresAt: r.effective_expires_at ?? r.expires_at,
    }));

    return Response.json({
      questionnaires,
      count: questionnaires.length,
    });
  } catch (err: any) {
    console.error("[questionnaire/active] GET failed:", err);
    return Response.json({ message: "Failed to load active questionnaires" }, { status: 500 });
  }
}
