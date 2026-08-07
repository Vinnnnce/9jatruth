import { ensureDbInitialized } from "@/lib/db";
import { findClustersNearby } from "@/lib/neon-storage";
import { getIpLocation } from "@/lib/api-helpers";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  const radius = searchParams.get("radius") ? parseInt(searchParams.get("radius") as string) : 2000;

  // Always return the user's IP-based location for auto-detection
  const ipLocation = await getIpLocation(request);

  const userLocation = {
    lat: !isNaN(lat) ? lat : (ipLocation.ipLat ?? null),
    lng: !isNaN(lng) ? lng : (ipLocation.ipLng ?? null),
    region: ipLocation.ipRegion,
    city: ipLocation.ipCity,
    ipHash: ipLocation.ipHash,
  };

  if (userLocation.lat === null || userLocation.lng === null) {
    return Response.json({ userLocation, message: "Could not determine location. Using default." });
  }

  const clusters = await findClustersNearby(userLocation.lat, userLocation.lng, radius);
  return Response.json({ userLocation, clusters });
}
