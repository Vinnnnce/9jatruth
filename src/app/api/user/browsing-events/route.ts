import { ensureDbInitialized } from "@/lib/db";
import { recordBrowsingEvent } from "@/lib/neon-storage";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const clerkUserId = await getClerkUserId();
    const userHash = await getUserId(request);

    await recordBrowsingEvent({
      clerkUserId: clerkUserId ?? null,
      userHash,
      eventType: body.eventType || "feed_view",
      truthId: body.truthId ?? null,
      neighborhoodId: body.neighborhoodId ?? null,
      category: body.category ?? null,
      path: body.path ?? null,
      metadata: body.metadata ?? null,
      dwellMs: body.dwellMs ?? 0,
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error("[browsing-events] Error:", err);
    return Response.json({ message: "Failed to record event" }, { status: 500 });
  }
}
