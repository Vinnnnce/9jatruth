import { ensureDbInitialized } from "@/lib/db";
import { getCommunityFeeds, createCommunityFeed, type GeoLevel } from "@/lib/community-feeds";
import { reverseGeocode } from "@/lib/reverse-geocode";
import { analyzePost } from "@/lib/ai-community";
import { validate, validationErrorResponse, getUserId, getClerkUserId, getIpLocation } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

/**
 * GET /api/feeds/community
 *
 * Query params:
 *   level: near_you | community | ward | lga | state | all_nigeria
 *   stateId, lgaId, wardId, communityId: geo hierarchy IDs
 *   lat, lng, radiusKm: for near_you level
 *   category: filter by category
 *   limit, offset: pagination
 *   sortBy: recent | nearest | trending | trust
 *
 * Returns: { feeds: CommunityFeed[], total: number }
 */
export const dynamic = "force-dynamic";

const communityFeedQuerySchema = z.object({
  level: z.enum(["near_you", "community", "ward", "lga", "state", "all_nigeria"]).default("all_nigeria"),
  stateId: z.coerce.number().int().positive().optional(),
  lgaId: z.coerce.number().int().positive().optional(),
  wardId: z.coerce.number().int().positive().optional(),
  communityId: z.coerce.number().int().positive().optional(),
  stateName: z.string().optional(),
  lgaName: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(200).default(5),
  category: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(["recent", "nearest", "trending", "trust"]).default("recent"),
});

export async function GET(request: Request) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(request.url);
    const queryObj = Object.fromEntries(searchParams.entries());
    const parsed = validate(communityFeedQuerySchema, queryObj);
    if (!parsed.success) return validationErrorResponse(parsed.error);

    const q = parsed.data;
    const userHash = await getUserId(request).catch(() => null);

    // If near_you and no lat/lng provided, try IP-based location
    let lat = q.lat;
    let lng = q.lng;
    if (q.level === "near_you" && (lat == null || lng == null)) {
      const ipLocation = await getIpLocation(request);
      lat = ipLocation.ipLat ?? undefined;
      lng = ipLocation.ipLng ?? undefined;
    }

    const result = await getCommunityFeeds({
      level: q.level as GeoLevel,
      stateId: q.stateId ?? null,
      lgaId: q.lgaId ?? null,
      wardId: q.wardId ?? null,
      communityId: q.communityId ?? null,
      stateName: q.stateName ?? null,
      lgaName: q.lgaName ?? null,
      lat: lat ?? null,
      lng: lng ?? null,
      radiusKm: q.radiusKm,
      category: q.category,
      limit: q.limit,
      offset: q.offset,
      sortBy: q.sortBy,
      userHash,
    });

    return Response.json(result);
  } catch (error: any) {
    console.error("[feeds/community] GET error:", error);
    return Response.json({ error: error?.message || "Internal server error", stack: error?.stack?.substring(0, 500) }, { status: 500 });
  }
}

/**
 * POST /api/feeds/community
 *
 * Create a new community feed post with geo hierarchy assignment.
 * If lat/lng is provided, auto-assigns state/LGA/ward/community via reverse geocoding.
 * If no location is provided, AI predicts the community from content.
 */
const createFeedSchema = z.object({
  content: z.string().min(10, "Content must be at least 10 characters").max(2000),
  category: z.enum(["power", "fuel", "traffic", "prices", "safety", "security", "real-estate", "housing", "patrol-gas-station", "restaurant", "hotel", "school", "pharmacy", "hospital", "supermarket"]),
  neighborhoodId: z.coerce.number().int().positive().optional(),
  neighborhoodName: z.string().optional(),
  regionName: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  locationSource: z.enum(["gps", "ip", "manual"]).default("manual"),
  stateId: z.coerce.number().int().positive().optional(),
  lgaId: z.coerce.number().int().positive().optional(),
  wardId: z.coerce.number().int().positive().optional(),
  communityId: z.coerce.number().int().positive().optional(),
  stateName: z.string().optional(),
  lgaName: z.string().optional(),
  communityName: z.string().optional(),
  villageName: z.string().optional(),
  organizationId: z.coerce.number().int().positive().optional(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized — Please sign in to submit a report" }, { status: 401 });
    }
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  try {
    const body = await request.json();
    const parsed = validate(createFeedSchema, body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const data = parsed.data;

    // Resolve neighborhood
    let neighborhoodId = data.neighborhoodId;
    if (!neighborhoodId && data.neighborhoodName) {
      const name = String(data.neighborhoodName).trim();
      if (name.length < 2) {
        return Response.json({ message: "Neighborhood name too short" }, { status: 400 });
      }
      try {
        const { getDb } = await import("@/lib/db");
        const sql = getDb();
        const existing: any[] = await sql`SELECT id FROM neighborhoods WHERE name ILIKE ${name} LIMIT 1` as unknown as any[];
        if (existing.length > 0) {
          neighborhoodId = existing[0].id;
        } else {
          const created: any[] = await sql`INSERT INTO neighborhoods (name, region, geo_hash, lat, lng) VALUES (${name}, ${data.regionName || "Unknown"}, ${"manual_" + name.toLowerCase().replace(/\s/g, "_")}, ${data.lat ?? 0}, ${data.lng ?? 0}) RETURNING id` as unknown as any[];
          neighborhoodId = created[0].id;
        }
      } catch (dbErr) {
        console.error("Neighborhood resolution error:", dbErr);
        return Response.json({ message: "Could not resolve neighborhood" }, { status: 500 });
      }
    }

    if (!neighborhoodId) {
      return Response.json({ message: "Please provide a neighborhood or area name" }, { status: 400 });
    }

    const userHash = await getUserId(request);

    // ── Step 1: Reverse geocode if lat/lng provided ──
    let stateId = data.stateId ?? undefined;
    let lgaId = data.lgaId ?? undefined;
    let wardId = data.wardId ?? undefined;
    let communityId = data.communityId ?? undefined;
    let stateName: string | null = data.stateName ?? null;
    let lgaName: string | null = data.lgaName ?? null;
    let communityName: string | null = data.communityName ?? null;

    if (data.lat != null && data.lng != null && !stateId && !lgaId) {
      try {
        const geoResult = await reverseGeocode(data.lat, data.lng);
        if (geoResult.state) {
          stateId = stateId ?? geoResult.state.id;
          stateName = stateName ?? geoResult.state.name;
        }
        if (geoResult.lga) {
          lgaId = lgaId ?? geoResult.lga.id;
          lgaName = lgaName ?? geoResult.lga.name;
        }
        if (geoResult.ward) {
          wardId = wardId ?? geoResult.ward.id;
        }
        if (geoResult.community) {
          communityId = communityId ?? geoResult.community.id;
          communityName = communityName ?? geoResult.community.name;
        }
      } catch (err) {
        console.error("[feeds/community] Reverse geocode failed:", err);
      }
    }

    // ── Step 2: If still no geo, try AI prediction ──
    if (!stateId && !stateName) {
      try {
        const { predictCommunityFromContent } = await import("@/lib/ai-community");
        const prediction = await predictCommunityFromContent(data.content, data.category);
        if (prediction.stateName) {
          stateName = prediction.stateName;
          lgaName = lgaName ?? prediction.lgaName;
          communityName = communityName ?? prediction.communityName;
        }
      } catch (err) {
        console.error("[feeds/community] AI prediction failed:", err);
      }
    }

    // ── Step 3: Create the feed post with geo IDs ──
    const feed = await createCommunityFeed({
      neighborhoodId,
      category: data.category,
      content: data.content,
      userHash,
      reportLat: data.lat ?? null,
      reportLng: data.lng ?? null,
      locationSource: data.locationSource,
      organizationId: data.organizationId ?? null,
      stateId: stateId ?? null,
      lgaId: lgaId ?? null,
      wardId: wardId ?? null,
      communityId: communityId ?? null,
      stateName: stateName ?? null,
      lgaName: lgaName ?? null,
      communityName: communityName ?? null,
      villageName: data.villageName ?? null,
      regionName: data.regionName ?? null,
    });

    if (!feed) {
      return Response.json({ message: "Failed to create post" }, { status: 500 });
    }

    // ── Step 4: Run AI analysis asynchronously ──
    analyzePost(feed.id, data.content, data.category, userHash).catch((err) => {
      console.error("[feeds/community] Background AI analysis failed:", err);
    });

    return Response.json({ feed, message: "Post created successfully" }, { status: 201 });
  } catch (err: any) {
    console.error("[feeds/community] POST error:", err);
    return Response.json({ message: err.message || "Internal server error" }, { status: 500 });
  }
}
