import { ensureDbInitialized } from "@/lib/db";
import { getAlerts } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  const result = await getAlerts();
  return Response.json(result);
}
