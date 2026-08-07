import { ensureDbInitialized } from "@/lib/db";
import { runAllPredictions } from "@/lib/neon-storage";

export async function POST() {
  await ensureDbInitialized();
  const result = await runAllPredictions();
  return Response.json({ success: true, ...result });
}
