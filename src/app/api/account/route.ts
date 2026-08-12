import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * DELETE /api/account — delete/anonymize user account
 * Requires Clerk auth. Deletes user data, anonymizes content.
 */
export async function DELETE(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const userHash = await getUserId(request);
  const sql = getDb();

  try {
    // Delete user-specific records
    await sql`DELETE FROM feed_comment_likes WHERE user_hash = ${userHash}`;
    await sql`DELETE FROM news_comment_likes WHERE user_hash = ${userHash}`;
    await sql`DELETE FROM user_browsing_events WHERE user_hash = ${userHash}`;
    await sql`DELETE FROM device_profiles WHERE user_hash = ${userHash}`;
    await sql`DELETE FROM reward_ledger WHERE user_hash = ${userHash}`;
    await sql`DELETE FROM poll_votes WHERE user_hash = ${userHash}`;
    await sql`DELETE FROM scheduled_content WHERE created_by = ${userHash} AND status = 'scheduled'`;

    // Anonymize content the user created (keep content but remove identity)
    await sql`UPDATE micro_truths SET user_hash = 'deleted_user' WHERE user_hash = ${userHash}`;
    await sql`UPDATE news_articles SET author_name = 'Deleted User' WHERE author_name IN (
      SELECT display_name FROM platform_users WHERE clerk_user_id = ${clerkUserId}
    )`;

    // Delete platform user record
    await sql`DELETE FROM platform_users WHERE clerk_user_id = ${clerkUserId}`;

    return Response.json({
      success: true,
      message: "Your account has been deleted. Your posts have been anonymized.",
    });
  } catch (err: any) {
    console.error("[account/delete] Error:", err);
    return Response.json({
      message: "Failed to delete account. Please try again or contact support.",
    }, { status: 500 });
  }
}
