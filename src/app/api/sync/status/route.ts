import { ensureDbInitialized } from "@/lib/db";
import { getSyncStatus } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const deviceHash = await getUserId(request);
  const result = await getSyncStatus(deviceHash);
  return Response.json(result);
}
