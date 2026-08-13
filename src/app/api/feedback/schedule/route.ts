import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

// Schedule: first prompt within 24 hours of signup, then monthly (end of every month)
const FIRST_PROMPT_DELAY_HOURS = 24;
const MAX_FEEDBACK_PROMPTS = 12;

const feedbackSchema = z.object({
  category: z.string().max(50).default("general"),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  rating: z.number().int().min(0).max(5).default(0),
  pageUrl: z.string().max(500).optional(),
});

/**
 * GET /api/feedback/schedule — check if feedback prompt should show
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const userHash = await getUserId(request);
  const sql = getDb();

  const rows = (await sql`
    SELECT * FROM feedback_schedules WHERE user_hash = ${userHash}
  `) as unknown as any[];

  if (rows.length === 0) {
    // No schedule — create one with signup date now
    const newRows = (await sql`
      INSERT INTO feedback_schedules (user_hash, clerk_user_id, signup_date, first_prompt_shown, feedback_count, next_prompt_date)
      VALUES (${userHash}, ${clerkUserId}, NOW(), FALSE, 0, NOW() + INTERVAL '1 day')
      RETURNING *
    `) as unknown as any[];

    const schedule = newRows[0];
    const shouldShow = new Date(schedule.next_prompt_date) <= new Date() && schedule.feedback_count < MAX_FEEDBACK_PROMPTS;

    return Response.json({
      shouldShow,
      schedule: {
        signupDate: schedule.signup_date,
        firstPromptShown: schedule.first_prompt_shown,
        lastPromptDate: schedule.last_prompt_date,
        nextPromptDate: schedule.next_prompt_date,
        feedbackCount: schedule.feedback_count,
      },
    });
  }

  const schedule = rows[0];
  const now = new Date();
  const nextPrompt = new Date(schedule.next_prompt_date);
  const shouldShow = nextPrompt <= now && schedule.feedback_count < MAX_FEEDBACK_PROMPTS;

  return Response.json({
    shouldShow,
    schedule: {
      signupDate: schedule.signup_date,
      firstPromptShown: schedule.first_prompt_shown,
      lastPromptDate: schedule.last_prompt_date,
      nextPromptDate: schedule.next_prompt_date,
      feedbackCount: schedule.feedback_count,
    },
  });
}

/**
 * POST /api/feedback/schedule — record feedback submission, update schedule
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(feedbackSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const userHash = await getUserId(request);
  const sql = getDb();

  // Insert feedback record
  await sql`
    INSERT INTO user_feedback (clerk_user_id, user_hash, category, subject, message, rating, page_url, user_agent, status)
    VALUES (${clerkUserId}, ${userHash}, ${sanitizeText(data.category)},
            ${sanitizeText(data.subject)}, ${sanitizeText(data.message)},
            ${data.rating}, ${data.pageUrl || null},
            ${request.headers.get("user-agent") || null}, 'new')
  `;

  // Update or create schedule
  const existing = (await sql`
    SELECT * FROM feedback_schedules WHERE user_hash = ${userHash}
  `) as unknown as any[];

  const now = new Date();
  // Next prompt: end of next month (last day of the current month)
  const nextPromptDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  if (existing.length === 0) {
    await sql`
      INSERT INTO feedback_schedules (user_hash, clerk_user_id, signup_date, first_prompt_shown, first_prompt_date, last_prompt_date, next_prompt_date, feedback_count)
      VALUES (${userHash}, ${clerkUserId}, NOW(), TRUE, NOW(), NOW(), ${nextPromptDate}, 1)
    `;
  } else {
    await sql`
      UPDATE feedback_schedules
      SET first_prompt_shown = TRUE,
          first_prompt_date = COALESCE(first_prompt_date, NOW()),
          last_prompt_date = NOW(),
          next_prompt_date = ${nextPromptDate},
          feedback_count = feedback_count + 1
      WHERE user_hash = ${userHash}
    `;
  }

  return Response.json({
    success: true,
    message: "Feedback submitted. Next prompt scheduled.",
    nextPromptDate,
  });
}
