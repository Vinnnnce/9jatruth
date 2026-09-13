import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { z } from "zod";

/**
 * Admin: Update result status.
 * POST /api/admin/politics/results/[id]/status
 * Body: { status: "pending" | "verified" | "published" | "disputed" }
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const resultId = parseInt(id, 10);
  const body = await request.json().catch(() => null);
  const schema = z.object({ status: z.enum(["pending", "verified", "published", "disputed"]) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid status" }, { status: 400 });

  const sql = getDb();
  const result = ((await sql`UPDATE election_results SET status = ${parsed.data.status}, updated_at = NOW() WHERE id = ${resultId} RETURNING *`) as unknown as any[])[0];
  if (!result) return Response.json({ message: "Result not found" }, { status: 404 });
  return Response.json({ result });
}
