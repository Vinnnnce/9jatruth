import { ensureDbInitialized } from "@/lib/db";
import { getTrends } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  const result = await getTrends();
  return Response.json(result);
}
