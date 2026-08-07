import { ensureDbInitialized } from "@/lib/db";
import { getNeighborhood, runLocationConsistency } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const { reportLat, reportLng, neighborhoodId, reportTimestamp } = await request.json();
  if (!neighborhoodId) {
    return Response.json({ message: "neighborhoodId is required" }, { status: 400 });
  }
  const neighborhood = await getNeighborhood(neighborhoodId);
  if (!neighborhood) {
    return Response.json({ message: "Neighborhood not found" }, { status: 404 });
  }
  const deviceHash = await getUserId(request);
  const result = await runLocationConsistency({
    reportLat,
    reportLng,
    neighborhood,
    deviceHash,
    reportTimestamp: reportTimestamp || new Date().toISOString(),
  });
  return Response.json(result);
}
