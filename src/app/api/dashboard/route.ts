import { ensureDbInitialized } from "@/lib/db";
import {
  getNeighborhoods,
  getSnapshots,
  getTruths,
  getPredictions,
} from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  try {
    const [neighborhoods, snapshots, truths] = await Promise.all([
      getNeighborhoods(),
      getSnapshots(),
      getTruths(100),
    ]);

    const dashboards = await Promise.all(
      neighborhoods.map(async (n) => {
        const snapshot = snapshots.find((s) => s.neighborhoodId === n.id);
        const neighborhoodTruths = truths.filter((t) => t.neighborhoodId === n.id);
        const predictions = await getPredictions(undefined, n.id);
        return {
          neighborhood: n,
          snapshot,
          recentTruths: neighborhoodTruths.slice(0, 5),
          predictions: predictions.slice(0, 3),
        };
      })
    );

    return Response.json(dashboards);
  } catch (err) {
    console.error("[api/dashboard] Error:", err);
    return Response.json([]);
  }
}
