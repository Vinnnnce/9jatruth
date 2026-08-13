import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/** GET /api/polls/[id] — get a single poll with options and user vote status */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();
  const sql = getDb();
  const { id } = await params;
  const pollId = Number(id);

  const polls = (await sql`SELECT * FROM polls WHERE id = ${pollId}`) as unknown as any[];
  if (polls.length === 0) return Response.json({ message: "Poll not found" }, { status: 404 });

  const options = (await sql`SELECT * FROM poll_options WHERE poll_id = ${pollId} ORDER BY display_order`) as unknown as any[];

  let userVote: number | null = null;
  try {
    const userHash = await getUserId(request);
    if (userHash) {
      const votes = (await sql`SELECT option_id FROM poll_votes WHERE poll_id = ${pollId} AND user_hash = ${userHash}`) as unknown as any[];
      if (votes.length > 0) userVote = votes[0].option_id;
    }
  } catch {}

  return Response.json({
    id: polls[0].id,
    question: polls[0].question,
    contentType: polls[0].content_type,
    contentId: polls[0].content_id,
    isActive: polls[0].is_active,
    totalVotes: polls[0].total_votes,
    expiresAt: polls[0].expires_at,
    createdAt: polls[0].created_at,
    userVote,
    options: options.map(o => ({
      id: o.id,
      text: o.text,
      voteCount: o.vote_count,
    })),
  });
}

/** DELETE /api/polls/[id] — delete a poll (owner or admin only) */
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
  const { id } = await params;
  const pollId = Number(id);

  const polls = (await sql`SELECT created_by FROM polls WHERE id = ${pollId}`) as unknown as any[];
  if (polls.length === 0) return Response.json({ message: "Poll not found" }, { status: 404 });

  if (polls[0].created_by !== userHash) {
    return Response.json({ message: "Only the poll creator can delete it" }, { status: 403 });
  }

  await sql`DELETE FROM polls WHERE id = ${pollId}`;
  return Response.json({ success: true });
}
