import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId, getUserId, getIpLocation } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

/**
 * GET /api/user/location — Get user's detected and preferred location
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userHash = await getUserId(request);
  const ipLocation = await getIpLocation(request);
  const sql = getDb();

  // Get preferred location from platform_users
  const rows = (await sql`
    SELECT preferred_neighborhood_id, preferred_state_name, preferred_lga_name,
           preferred_community_name, preferred_region_name, preferred_lat, preferred_lng,
           location_source, location_updated_at
    FROM platform_users WHERE clerk_user_id = ${clerkUserId}
  `) as unknown as any[];

  const preferred = rows[0] || {};
  const neighborhoods = (await sql`
    SELECT id, name, region, lat, lng FROM neighborhoods ORDER BY name
  `) as unknown as any[];

  return Response.json({
    detected: {
      region: ipLocation.ipRegion || null,
      city: ipLocation.ipCity || null,
      lat: ipLocation.ipLat || null,
      lng: ipLocation.ipLng || null,
    },
    preferred: preferred.preferred_neighborhood_id ? {
      neighborhoodId: preferred.preferred_neighborhood_id,
      stateName: preferred.preferred_state_name,
      lgaName: preferred.preferred_lga_name,
      communityName: preferred.preferred_community_name,
      regionName: preferred.preferred_region_name,
      lat: preferred.preferred_lat,
      lng: preferred.preferred_lng,
      source: preferred.location_source,
      updatedAt: preferred.location_updated_at,
    } : null,
    neighborhoods: neighborhoods.map((n) => ({
      id: n.id,
      name: n.name,
      region: n.region,
      lat: n.lat,
      lng: n.lng,
    })),
  });
}

/**
 * PUT /api/user/location — Save user's preferred neighborhood/location
 */
export async function PUT(request: Request) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json();
  const { neighborhoodId, stateName, lgaName, communityName, regionName, lat, lng } = body;

  if (!neighborhoodId && !stateName) {
    return Response.json({ message: "neighborhoodId or stateName is required" }, { status: 400 });
  }

  const sql = getDb();
  const userHash = await getUserId(request);

  await sql`
    UPDATE platform_users SET
      preferred_neighborhood_id = ${neighborhoodId || null},
      preferred_state_name = ${stateName || null},
      preferred_lga_name = ${lgaName || null},
      preferred_community_name = ${communityName || null},
      preferred_region_name = ${regionName || null},
      preferred_lat = ${lat || null},
      preferred_lng = ${lng || null},
      location_source = 'manual',
      location_updated_at = NOW()
    WHERE clerk_user_id = ${clerkUserId}
  `;

  return Response.json({ success: true, message: "Location updated" });
}
