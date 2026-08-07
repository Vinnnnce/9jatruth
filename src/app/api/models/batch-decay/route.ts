import { ensureDbInitialized } from "@/lib/db";
import { batchDecayTruths } from "@/lib/neon-storage";

export async function POST() {
  await ensureDbInitialized();
  const updates = await batchDecayTruths();
  return Response.json({ processed: updates.length, updates: updates.slice(0, 20) });
}
