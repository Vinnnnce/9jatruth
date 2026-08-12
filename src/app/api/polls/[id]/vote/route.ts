import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

const voteSchema = z.object({
  optionId: z.number().int().positive(),
});

/** POST /api/polls/[id]/vote — vote on a poll (requires auth) */
export async function POST(
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

  let body: any;
  try { body = await request.json(); } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const { optionId } = voteSchema.parse(body);

  // Check poll exists and is active
  const polls = (await sql`SELECT * FROM polls WHERE id = ${pollId} AND is_active = true`) as unknown as any[];
  if (polls.length === 0) return Response.json({ message: "Poll not found or inactive" }, { status: 404 });

  // Check expiry
  if (polls[0].expires_at && new Date(polls[0].expires_at) < new Date()) {
    return Response.json({ message: "Poll has expired" }, { status: 400 });
  }

  // Verify option belongs to poll
  const options = (await sql`SELECT id FROM poll_options WHERE id = ${optionId} AND poll_id = ${pollId}`) as unknown as any[];
  if (options.length === 0) return Response.json({ message: "Invalid option" }, { status: 400 });

  // Insert vote (unique constraint prevents double voting)
  try {
    await sql`
      INSERT INTO poll_votes (poll_id, option_id, user_hash)
      VALUES (${pollId}, ${optionId}, ${userHash})
    `;
  } catch {
    return Response.json({ message: "You have already voted on this poll" }, { status: 409 });
  }

  // Update counts
  await sql`UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = ${optionId}`;
  await sql`UPDATE polls SET total_votes = total_votes + 1 WHERE id = ${pollId}`;

  // Return updated poll
  const updatedOptions = (await sql`SELECT * FROM poll_options WHERE poll_id = ${pollId} ORDER BY display_order`) as unknown as any[];
  const updatedPoll = (await sql`SELECT * FROM polls WHERE id = ${pollId}`) as unknown as any[];

  return Response.json({
    id: pollId,
    totalVotes: updatedPoll[0].total_votes,
    userVote: optionId,
    options: updatedOptions.map(o => ({
      id: o.id,
      text: o.text,
      voteCount: o.vote_count,
    })),
  });
}
