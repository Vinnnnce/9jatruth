import { ensureDbInitialized } from "@/lib/db";
import { getTrends } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  try {
    const result = await getTrends();
    return Response.json(result);
  } catch (err) {
    console.error("[api/trends] Error:", err);
    return Response.json({ categoryTrends: [], neighborhoodTrends: [], hourlyData: [], topNeighborhoods: [] });
  }
}
