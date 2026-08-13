import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const updateSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(["scheduled", "cancelled"]).optional(),
});

/** DELETE /api/schedule/[id] — cancel a scheduled post */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const userHash = await getUserId(request);
  const sql = getDb();
  const { id: idStr } = await params;
  const id = Number(idStr);

  const rows = (await sql`SELECT created_by, status FROM scheduled_content WHERE id = ${id}`) as unknown as any[];
  if (rows.length === 0) return Response.json({ message: "Not found" }, { status: 404 });
  if (rows[0].created_by !== userHash) return Response.json({ message: "Forbidden" }, { status: 403 });
  if (rows[0].status === "published") return Response.json({ message: "Already published" }, { status: 400 });

  await sql`UPDATE scheduled_content SET status = 'cancelled' WHERE id = ${id}`;
  return Response.json({ success: true });
}

/** PATCH /api/schedule/[id] — update scheduled time or cancel */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const userHash = await getUserId(request);
  const sql = getDb();
  const { id: idStr } = await params;
  const id = Number(idStr);

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message || "Invalid" }, { status: 400 });

  const rows = (await sql`SELECT created_by, status FROM scheduled_content WHERE id = ${id}`) as unknown as any[];
  if (rows.length === 0) return Response.json({ message: "Not found" }, { status: 404 });
  if (rows[0].created_by !== userHash) return Response.json({ message: "Forbidden" }, { status: 403 });
  if (rows[0].status === "published") return Response.json({ message: "Already published" }, { status: 400 });

  if (parsed.data.scheduledAt) {
    const newDate = new Date(parsed.data.scheduledAt);
    if (newDate <= new Date()) return Response.json({ message: "Must be future" }, { status: 400 });
    await sql`UPDATE scheduled_content SET scheduled_at = ${newDate} WHERE id = ${id}`;
  }
  if (parsed.data.status) {
    await sql`UPDATE scheduled_content SET status = ${parsed.data.status} WHERE id = ${id}`;
  }

  return Response.json({ success: true });
}
