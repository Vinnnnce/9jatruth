import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getIpLocation } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

/**
 * Answer value can be a string, number, boolean, or array of strings
 * (for multiple-choice). Anything else is coerced/rejected.
 */
const answerValue = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(2000)).max(50),
]);

const answerSchema = z.object({
  questionnaireId: z.coerce.number().int().positive().max(1_000_000),
  responses: z.record(z.string().min(1).max(100), answerValue),
});

/**
 * POST /api/questionnaire/answer
 *
 * Public — submit a full set of answers for an active, non-expired
 * questionnaire. Validates that every submitted question id belongs to
 * the questionnaire and that all required questions are answered.
 *
 * Works for both authenticated (Clerk) and anonymous users; anonymous
 * submissions are keyed by an IP hash for dedupe/audit purposes.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid input", errors: parsed.error.issues },
      { status: 400 },
    );
  }
  const { questionnaireId, responses } = parsed.data;

  const sql = getDb();

  // Load the questionnaire and confirm it is active + not expired.
  const qRows = (await sql`
    SELECT id, title, questions, status,
           COALESCE(expires_at, created_at + INTERVAL '24 hours') AS effective_expires_at
    FROM questionnaires
    WHERE id = ${questionnaireId}
    LIMIT 1
  `) as unknown as any[];

  if (qRows.length === 0) {
    return Response.json({ message: "Questionnaire not found" }, { status: 404 });
  }

  const q = qRows[0];
  if (q.status !== "active") {
    return Response.json({ message: "Questionnaire is no longer active" }, { status: 410 });
  }
  const expired = q.effective_expires_at ? new Date(q.effective_expires_at).getTime() <= Date.now() : false;
  if (expired) {
    return Response.json({ message: "Questionnaire has expired" }, { status: 410 });
  }

  const questions: any[] = q.questions ? JSON.parse(q.questions) : [];
  const byId = new Map(questions.map((qq) => [String(qq.id), qq]));

  // Validate submitted question ids belong to this questionnaire.
  for (const key of Object.keys(responses)) {
    if (!byId.has(key)) {
      return Response.json(
        { message: `Unknown question id: ${key}` },
        { status: 400 },
      );
    }
  }

  // Enforce required questions server-side.
  const missingRequired = questions
    .filter((qq) => qq.required && !byId.has(String(qq.id)) ? false : (qq.required && (responses[String(qq.id)] === undefined || responses[String(qq.id)] === "" || (Array.isArray(responses[String(qq.id)]) && (responses[String(qq.id)] as any[]).length === 0))))
    .map((qq) => String(qq.text || qq.id));

  if (missingRequired.length > 0) {
    return Response.json(
      { message: "Please answer all required questions", errors: missingRequired },
      { status: 400 },
    );
  }

  // Resolve submitter identity (Clerk if available, otherwise IP hash).
  const clerkUserId = await getClerkUserId();
  const ipLocation = await getIpLocation(request);

  let email = "";
  let displayName = "";
  if (clerkUserId) {
    const user = await currentUser();
    email = user?.emailAddresses?.[0]?.emailAddress || "";
    displayName = user?.firstName
      ? `${user.firstName} ${user.lastName || ""}`.trim()
      : user?.username || "";
  }

  const payload = { _questionnaireId: questionnaireId, answers: responses };

  const inserted = (await sql`
    INSERT INTO questionnaire_responses (
      clerk_user_id, user_hash, email, display_name,
      questionnaire_type, responses, ip_hash, status
    )
    VALUES (
      ${clerkUserId}, ${ipLocation.ipHash ?? null}, ${email || null}, ${displayName || null},
      ${q.title || "general"}, ${JSON.stringify(payload)}, ${ipLocation.ipHash ?? null}, 'submitted'
    )
    RETURNING id
  `) as unknown as { id: number }[];

  return Response.json({
    success: true,
    id: inserted[0]?.id,
    message: "Thank you for participating!",
  });
}
