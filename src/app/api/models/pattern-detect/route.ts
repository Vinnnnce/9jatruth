import { ensureDbInitialized } from "@/lib/db";
import { getNeighborhood, getTruths, runPatternDetection } from "@/lib/neon-storage";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const { category, neighborhoodId } = await request.json();
  if (!category || !neighborhoodId) {
    return Response.json({ message: "category and neighborhoodId are required" }, { status: 400 });
  }
  const neighborhood = await getNeighborhood(neighborhoodId);
  if (!neighborhood) return Response.json({ message: "Neighborhood not found" }, { status: 404 });
  const truths = await getTruths(50, neighborhoodId, category);
  const result = runPatternDetection({ truths, category, neighborhood });
  return Response.json(result);
}
