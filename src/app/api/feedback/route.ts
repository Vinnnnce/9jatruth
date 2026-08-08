import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getIpLocation, sanitizeText } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

const feedbackSchema = z.object({
  category: z.string().max(50).default("general"),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  rating: z.number().int().min(0).max(5).default(0),
  pageUrl: z.string().max(500).optional(),
});

/**
 * POST /api/feedback — submit user feedback (sends to admin dashboard)
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid input", errors: parsed.error.issues }, { status: 400 });
  }

  const sql = getDb();
  const clerkUserId = await getClerkUserId();
  const ipLocation = await getIpLocation(request);

  let email = "";
  let displayName = "";
  if (clerkUserId) {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress || "";
    displayName = user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : (user?.username || "");
  }

  const rows = (await sql`
    INSERT INTO user_feedback (clerk_user_id, user_hash, email, display_name, category, subject, message, rating, page_url, user_agent, ip_hash)
    VALUES (${clerkUserId}, ${ipLocation.ipHash ?? null}, ${email || null}, ${displayName || null},
            ${sanitizeText(parsed.data.category)}, ${sanitizeText(parsed.data.subject)},
            ${sanitizeText(parsed.data.message)}, ${parsed.data.rating},
            ${parsed.data.pageUrl ?? null}, ${request.headers.get("user-agent") ?? null},
            ${ipLocation.ipHash ?? null})
    RETURNING id
  `) as unknown as { id: number }[];

  return Response.json({ success: true, id: rows[0]?.id, message: "Feedback submitted to admin dashboard" });
}

/**
 * GET /api/feedback — list feedback (admin only)
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress || "";
  if (email !== "insights793@gmail.com") {
    return Response.json({ message: "Admin access required" }, { status: 403 });
  }

  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const rows = status === "all"
    ? (await sql`SELECT * FROM user_feedback ORDER BY created_at DESC LIMIT ${limit}`) as unknown as any[]
    : (await sql`SELECT * FROM user_feedback WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit}`) as unknown as any[];

  return Response.json({ feedback: rows });
}
