import { ensureDbInitialized } from "@/lib/db";
import { getRewardBalance } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const userHash = await getUserId(request);
  const balance = await getRewardBalance(userHash);
  return Response.json({ userHash, balance });
}
