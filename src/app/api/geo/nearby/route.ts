import { ensureDbInitialized } from "@/lib/db";
import { findClustersNearby } from "@/lib/neon-storage";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  const radius = searchParams.get("radius") ? parseInt(searchParams.get("radius") as string) : 2000;
  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ message: "Invalid lat/lng parameters" }, { status: 400 });
  }
  const clusters = await findClustersNearby(lat, lng, radius);
  return Response.json(clusters);
}
