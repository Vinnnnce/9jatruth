import { ensureDbInitialized } from "@/lib/db";
import { getLeaderboard } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  const result = await getLeaderboard();
  return Response.json(result);
}
