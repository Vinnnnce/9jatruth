import { ensureDbInitialized } from "@/lib/db";
import { unsubscribe } from "@/lib/neon-storage";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const deviceHash = await getUserId(request);
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (endpoint) {
    await unsubscribe(deviceHash, endpoint);
  }
  return Response.json({ success: true });
}
