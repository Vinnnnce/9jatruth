import { ensureDbInitialized } from "@/lib/db";
import { getLocationBasedPredictions, generateLocationBasedPredictions } from "@/lib/neon-storage";
import { getIpLocation, getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { rateLimit } from "@/lib/rate-limiter";

/**
 * GET /api/ai/feed-predictions
 * Returns AI predictions relevant to the user's location for display in the feed.
 * Uses IP-based geolocation as fallback when no GPS coordinates are provided.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "5", 10), 20);

  let userLat = !isNaN(lat) ? lat : null;
  let userLng = !isNaN(lng) ? lng : null;

  // Fall back to IP-based location
  if (userLat === null || userLng === null) {
    const ipLocation = await getIpLocation(request);
    userLat = ipLocation.ipLat ?? 6.5244; // Default to Lagos
    userLng = ipLocation.ipLng ?? 3.3792;
  }

  const predictions = await getLocationBasedPredictions(
    { lat: userLat, lng: userLng },
    limit
  );

  return Response.json({
    predictions,
    userLocation: { lat: userLat, lng: userLng },
  });
}

/**
 * POST /api/ai/feed-predictions
 * Triggers AI prediction generation for the user's area.
 * Rate-limited to prevent abuse.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  // Rate limit: max 5 generation calls per minute
  const clerkUserId = await getClerkUserId();
  const rateKey = `feed-predictions:${clerkUserId || "anonymous"}`;
  const rateLimited = rateLimit(rateKey, 5, 60_000);
  if (rateLimited) return rateLimited;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  let lat = typeof body.lat === "number" ? body.lat : null;
  let lng = typeof body.lng === "number" ? body.lng : null;

  // Fall back to IP-based location
  if (lat === null || lng === null) {
    const ipLocation = await getIpLocation(request);
    lat = ipLocation.ipLat ?? 6.5244;
    lng = ipLocation.ipLng ?? 3.3792;
  }

  const result = await generateLocationBasedPredictions({
    lat,
    lng,
    region: body.region ?? null,
    city: body.city ?? null,
  });

  return Response.json({
    success: true,
    ...result,
    userLocation: { lat, lng },
  });
}
