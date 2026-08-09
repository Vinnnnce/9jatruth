import { ensureDbInitialized } from "@/lib/db";
import { getAlerts } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  try {
    const result = await getAlerts();
    return Response.json(result);
  } catch (err) {
    console.error("[api/alerts] Error:", err);
    return Response.json([]);
  }
}
