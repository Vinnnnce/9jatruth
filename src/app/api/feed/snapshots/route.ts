import { ensureDbInitialized } from "@/lib/db";
import { getFeedSnapshots } from "@/lib/neon-storage";

export async function GET(request: Request) {
  await ensureDbInitialized();
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country") || undefined;
    const region = searchParams.get("region") || undefined;
    const state = searchParams.get("state") || undefined;
    const lga = searchParams.get("lga") || undefined;
    const data = await getFeedSnapshots(country, region, state, lga);
    return Response.json(data);
  } catch (err) {
    console.error("[feed/snapshots] Error:", err);
    return Response.json({
      summary: { activeTruths: 0, neighborhoods: 0, avgSafetyIndex: 70, avgPriceIndex: 100, meshNodes: 0 },
      neighborhoods: [],
    });
  }
}
