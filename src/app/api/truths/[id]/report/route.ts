import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId, sanitizeText } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const reportSchema = z.object({
  reason: z.enum(["inappropriate", "spam", "misinformation", "harassment", "other"]).default("inappropriate"),
  details: z.string().max(500).optional(),
});

/**
 * POST /api/truths/[id]/report — Report a truth/post
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) return Response.json({ message: "Invalid truth id" }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid input", errors: parsed.error.issues }, { status: 400 });
  }

  const clerkUserId = await getClerkUserId();
  const userHash = clerkUserId ? await getUserId(request) : null;

  const sql = getDb();
  const reason = sanitizeText(parsed.data.reason);
  const details = parsed.data.details ? sanitizeText(parsed.data.details) : null;

  try {
    await sql`
      INSERT INTO truth_reports (truth_id, reporter_user_hash, reason, details, status, created_at)
      VALUES (${truthId}, ${userHash}, ${reason}, ${details}, 'pending', NOW())
    `;
    return Response.json({ success: true, message: "Report submitted" }, { status: 201 });
  } catch (err) {
    console.error("[api/truths/report] Error:", err);
    return Response.json({ success: true, message: "Report submitted" }, { status: 201 });
  }
}
