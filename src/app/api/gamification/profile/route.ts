import { ensureDbInitialized } from "@/lib/db";
import { getGamificationProfile } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const deviceHash = await getUserId(request);
  const profile = await getGamificationProfile(deviceHash);
  return Response.json(profile);
}
