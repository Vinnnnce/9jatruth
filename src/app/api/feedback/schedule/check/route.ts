import { ensureDbInitialized, getDb } from "@/lib/db";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";

/**
 * GET /api/feedback/schedule/check — check feedback schedule status for current user
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
    return Response.json({
      hasSchedule: false,
      shouldShow: false,
      feedbackCount: 0,
      message: "No feedback schedule found",
    });
  }

  const schedule = rows[0];
  const now = new Date();
  const nextPrompt = schedule.next_prompt_date ? new Date(schedule.next_prompt_date) : null;
  const maxPrompts = 12;

  const shouldShow = nextPrompt !== null && nextPrompt <= now && schedule.feedback_count < maxPrompts;

  return Response.json({
    hasSchedule: true,
    shouldShow,
    schedule: {
      signupDate: schedule.signup_date,
      firstPromptShown: schedule.first_prompt_shown,
      firstPromptDate: schedule.first_prompt_date,
      lastPromptDate: schedule.last_prompt_date,
      nextPromptDate: schedule.next_prompt_date,
      feedbackCount: schedule.feedback_count,
    },
  });
}
