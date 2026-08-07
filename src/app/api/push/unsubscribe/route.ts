import { ensureDbInitialized } from "@/lib/db";
import { unsubscribe } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const deviceHash = await getUserId(request);
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (endpoint) {
    await unsubscribe(deviceHash, endpoint);
  }
  return Response.json({ success: true });
}
