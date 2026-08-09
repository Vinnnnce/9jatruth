import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getIpLocation } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

const questionnaireSchema = z.object({
  questionnaireType: z.string().max(50).default("general"),
  responses: z.record(z.string(), z.any()),
});

/**
 * POST /api/questionnaire — submit questionnaire (sends to admin dashboard)
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = questionnaireSchema.safeParse(body);
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
    INSERT INTO questionnaire_responses (clerk_user_id, user_hash, email, display_name, questionnaire_type, responses, ip_hash)
    VALUES (${clerkUserId}, ${ipLocation.ipHash ?? null}, ${email || null}, ${displayName || null},
            ${parsed.data.questionnaireType}, ${JSON.stringify(parsed.data.responses)},
            ${ipLocation.ipHash ?? null})
    RETURNING id
  `) as unknown as { id: number }[];

  // Also create a feed post so the questionnaire appears on the feeds page
  try {
    const questionnaireId = rows[0]?.id;
    const summaryText = Object.entries(parsed.data.responses)
      .slice(0, 3)
      .map(([key, val]) => `${key.replace(/_/g, " ")}: ${String(val)}`)
      .join("; ");
    const feedContent = `📋 Questionnaire Response: ${summaryText.slice(0, 400)}`;
    await sql`
      INSERT INTO micro_truths (neighborhood_id, category, content, trust_score, decay_factor, verification_chain, user_hash, status, ip_hash, ip_region, ip_city, state_name, region_name)
      VALUES (1, 'safety', ${feedContent}, 50, 1.0, '[]', ${ipLocation.ipHash ?? clerkUserId ?? "anonymous"}, 'pending', ${ipLocation.ipHash ?? null}, ${ipLocation.ipRegion ?? null}, ${ipLocation.ipCity ?? null}, ${ipLocation.ipRegion ?? null}, ${ipLocation.ipRegion ?? null})
    `;
  } catch (e) {
    console.error("[questionnaire] Could not create feed post:", e);
    // Non-critical — questionnaire is still saved
  }

  return Response.json({ success: true, id: rows[0]?.id, message: "Questionnaire submitted to admin dashboard and feeds" });
}

/**
 * GET /api/questionnaire — list responses (admin only)
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();

  // Allow access in dev mode when Clerk isn't configured
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
  if (isClerkConfigured && !clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  if (isClerkConfigured) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || "";
    if (email !== "insights793@gmail.com") {
      return Response.json({ message: "Admin access required" }, { status: 403 });
    }
  }

  const sql = getDb();
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const rows = (await sql`SELECT * FROM questionnaire_responses ORDER BY created_at DESC LIMIT ${limit}`) as unknown as any[];

  return Response.json({ responses: rows });
}
