import { ensureDbInitialized } from "@/lib/db";
import { getHealth } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  const health = await getHealth();
  return Response.json(health);
}
