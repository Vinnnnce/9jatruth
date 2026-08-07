import { ensureDbInitialized } from "@/lib/db";
import { getClustersForNeighborhood, getHeatmapData } from "@/lib/neon-storage";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const neighborhoodIdParam = searchParams.get("neighborhoodId");
  const neighborhoodId = neighborhoodIdParam ? parseInt(neighborhoodIdParam) : undefined;

  if (neighborhoodId && !isNaN(neighborhoodId)) {
    const clusters = await getClustersForNeighborhood(neighborhoodId);
    return Response.json(clusters);
  }
  const heatmap = await getHeatmapData();
  return Response.json(heatmap);
}
