import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * GET /api/feeds/nearby?lat=...&lng=...&radius_km=...&ward=&lga=&state=&category=&limit=&offset=
 *
 * Location-based feed: returns posts (micro_truths) nearest to the caller's
 * coordinates, within `radius_km`. Posts are geo-indexed via micro_truths.report_lat
 * /report_lng (falling back to the neighborhood centroid). Optional filters by
 * ward (community), LGA, state, and category. Ordered by distance ascending.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return Response.json({ message: "lat and lng are required (numeric)" }, { status: 400 });
  }
  const radiusKm = Math.min(Math.max(parseFloat(searchParams.get("radius_km") || "5") || 5, 0.5), 200);
  const ward = searchParams.get("ward");
  const lga = searchParams.get("lga");
  const state = searchParams.get("state");
  const category = searchParams.get("category");
  const limit = Math.min(parseInt(searchParams.get("limit") || "40", 10) || 40, 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const sql = getDb();

  // Haversine distance (km) from the caller to each post's reported location
  // (falling back to the neighborhood centroid when the post has no coords).
  const rows = (await sql`
    SELECT t.id, t.category, t.content, t.trust_score, t.status, t.created_at,
           t.organization_id, n.name AS neighborhood_name, n.region,
           coalesce(t.report_lat, n.lat) AS lat,
           coalesce(t.report_lng, n.lng) AS lng,
           (6371 * acos(
              LEAST(1, GREATEST(-1,
                cos(radians(${lat})) * cos(radians(coalesce(t.report_lat, n.lat)))
                * cos(radians(coalesce(t.report_lng, n.lng)) - radians(${lng}))
                + sin(radians(${lat})) * sin(radians(coalesce(t.report_lat, n.lat)))
              ))
           )) AS distance_km
    FROM micro_truths t
    JOIN neighborhoods n ON n.id = t.neighborhood_id
    WHERE t.status <> 'rejected'
      AND coalesce(t.report_lat, n.lat) IS NOT NULL
      AND (${ward ?? null}::text IS NULL OR n.community ILIKE ${"%" + (ward ?? "") + "%"})
      AND (${lga ?? null}::text IS NULL OR n.lga ILIKE ${"%" + (lga ?? "") + "%"})
      AND (${state ?? null}::text IS NULL OR n.state ILIKE ${"%" + (state ?? "") + "%"})
      AND (${category ?? null}::text IS NULL OR t.category = ${category ?? null})
    ORDER BY distance_km ASC
    LIMIT ${limit} OFFSET ${offset}`) as any;

  // Apply the radius filter in SQL would require the expression in WHERE; since
  // the distance is computed in SELECT, we filter here for accuracy.
  const within = (rows ?? [])
    .filter((r: any) => Number(r.distance_km) <= radiusKm)
    .map((r: any) => ({ ...r, distance_km: Number(Number(r.distance_km).toFixed(2)) }));

  return Response.json({
    feeds: within,
    count: within.length,
    radius_km: radiusKm,
    center: { lat, lng },
    filters: { ward, lga, state, category },
  });
}
