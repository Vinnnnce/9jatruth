import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/questionnaire/active
 *
 * Public endpoint — returns active questionnaires where:
 *   status = 'active'
 *   (expires_at IS NULL OR expires_at > NOW())
 *
 * Each questionnaire has its questions array parsed from JSON.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureDbInitialized();
    const sql = getDb();

    const rows = (await sql`
      SELECT * FROM questionnaires
      WHERE status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
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
      expiresAt: r.expires_at,
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
