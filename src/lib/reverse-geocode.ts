/**
 * Reverse Geocoding Service
 *
 * Resolves lat/lng coordinates to the Nigerian geo hierarchy:
 *   State → LGA → Ward → Community
 *
 * Strategy (in order of accuracy):
 *   1. PostGIS spatial query: find the nearest ward/LGA/community with coordinates
 *   2. Fallback: nearest neighborhood with coordinates (existing neighborhoods table)
 *   3. Fallback: text-based matching using known Nigerian geo centroids
 *
 * No external API dependency — uses the geo tables already in the database.
 * For higher accuracy, an external geocoding provider (e.g., Google Maps, OpenStreetMap
 * Nominatim) can be plugged in via REVERSE_GEOCODE_PROVIDER env var.
 */

import { getDb } from "@/lib/db";

type SqlRow = Record<string, any>;

export interface ReverseGeocodeResult {
  state: { id: number; name: string } | null;
  lga: { id: number; name: string } | null;
  ward: { id: number; name: string } | null;
  community: { id: number; name: string } | null;
  neighborhoodId: number | null;
  neighborhoodName: string | null;
  distanceKm: number | null;
  source: "postgis_ward" | "postgis_lga" | "postgis_neighborhood" | "centroid_fallback" | "ip_fallback";
}

/**
 * Reverse geocode lat/lng to the Nigerian geo hierarchy.
 *
 * @param lat Latitude
 * @param lng Longitude
 * @returns The resolved geo hierarchy with the closest matches
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const sql = getDb();

  // 1. Find the nearest community with coordinates (PostGIS)
  try {
    const communityRows = (await sql`
      SELECT c.id, c.name, c.lga_id, c.state_id, c.ward_id,
             ST_Distance(c.geog, ST_MakePoint(${lng}, ${lat})::geography) / 1000 AS distance_km
      FROM communities c
      WHERE c.geog IS NOT NULL
        AND ST_DWithin(c.geog, ST_MakePoint(${lng}, ${lat})::geography, 50000)
      ORDER BY distance_km ASC
      LIMIT 1
    `) as unknown as SqlRow[];

    if (communityRows[0]) {
      const c = communityRows[0];
      const distanceKm = Number(c.distance_km);

      // Resolve the full hierarchy from the community
      const hierarchy = await resolveHierarchyFromCommunity(c.id, c.lga_id, c.state_id, c.ward_id);

      if (hierarchy.state && hierarchy.lga) {
        return {
          ...hierarchy,
          neighborhoodId: null,
          neighborhoodName: null,
          distanceKm,
          source: "postgis_ward",
        };
      }
    }
  } catch (err) {
    console.error("[reverse-geocode] Community query failed:", err);
  }

  // 2. Find the nearest ward with coordinates (PostGIS)
  try {
    const wardRows = (await sql`
      SELECT w.id, w.name, w.lga_id, w.state_id,
             ST_Distance(
               COALESCE(w.geog, ST_MakePoint(w.lng, w.lat)::geography),
               ST_MakePoint(${lng}, ${lat})::geography
             ) / 1000 AS distance_km
      FROM wards w
      WHERE w.lat IS NOT NULL AND w.lng IS NOT NULL
        AND ST_DWithin(
          ST_MakePoint(w.lng, w.lat)::geography,
          ST_MakePoint(${lng}, ${lat})::geography,
          100000
        )
      ORDER BY distance_km ASC
      LIMIT 1
    `) as unknown as SqlRow[];

    if (wardRows[0]) {
      const w = wardRows[0];
      const distanceKm = Number(w.distance_km);
      const hierarchy = await resolveHierarchyFromWard(w.id, w.lga_id, w.state_id);

      if (hierarchy.state && hierarchy.lga) {
        return {
          ...hierarchy,
          neighborhoodId: null,
          neighborhoodName: null,
          distanceKm,
          source: "postgis_lga",
        };
      }
    }
  } catch (err) {
    console.error("[reverse-geocode] Ward query failed:", err);
  }

  // 3. Find the nearest LGA with coordinates (PostGIS)
  try {
    const lgaRows = (await sql`
      SELECT l.id, l.name, l.state_id,
             ST_Distance(
               ST_MakePoint(l.lng, l.lat)::geography,
               ST_MakePoint(${lng}, ${lat})::geography
             ) / 1000 AS distance_km
      FROM lgas l
      WHERE l.lat IS NOT NULL AND l.lng IS NOT NULL
        AND ST_DWithin(
          ST_MakePoint(l.lng, l.lat)::geography,
          ST_MakePoint(${lng}, ${lat})::geography,
          200000
        )
      ORDER BY distance_km ASC
      LIMIT 1
    `) as unknown as SqlRow[];

    if (lgaRows[0]) {
      const l = lgaRows[0];
      const distanceKm = Number(l.distance_km);
      const stateRows = (await sql`SELECT id, name FROM states WHERE id = ${l.state_id}`) as unknown as SqlRow[];

      if (stateRows[0]) {
        return {
          state: { id: stateRows[0].id, name: stateRows[0].name },
          lga: { id: l.id, name: l.name },
          ward: null,
          community: null,
          neighborhoodId: null,
          neighborhoodName: null,
          distanceKm,
          source: "postgis_lga",
        };
      }
    }
  } catch (err) {
    console.error("[reverse-geocode] LGA query failed:", err);
  }

  // 4. Fallback: nearest neighborhood with coordinates
  try {
    const nRows = (await sql`
      SELECT n.id, n.name, n.state, n.lga, n.community,
             (6371 * acos(
               LEAST(1, GREATEST(-1,
                 cos(radians(${lat})) * cos(radians(n.lat))
                 * cos(radians(n.lng) - radians(${lng}))
                 + sin(radians(${lat})) * sin(radians(n.lat))
               ))
             )) AS distance_km
      FROM neighborhoods n
      WHERE n.lat IS NOT NULL AND n.lng IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT 1
    `) as unknown as SqlRow[];

    if (nRows[0] && Number(nRows[0].distance_km) <= 200) {
      const n = nRows[0];
      const distanceKm = Number(n.distance_km);

      // Try to resolve state/LGA IDs from names
      const stateRows = (await sql`SELECT id FROM states WHERE name ILIKE ${n.state} LIMIT 1`) as unknown as SqlRow[];
      const lgaRows = stateRows[0]
        ? (await sql`SELECT id FROM lgas WHERE name ILIKE ${n.lga} AND state_id = ${stateRows[0].id} LIMIT 1`) as unknown as SqlRow[]
        : [];

      return {
        state: stateRows[0] ? { id: stateRows[0].id, name: n.state } : null,
        lga: lgaRows[0] ? { id: lgaRows[0].id, name: n.lga } : null,
        ward: null,
        community: null,
        neighborhoodId: n.id,
        neighborhoodName: n.name,
        distanceKm,
        source: "postgis_neighborhood",
      };
    }
  } catch (err) {
    console.error("[reverse-geocode] Neighborhood fallback failed:", err);
  }

  // 5. Last resort: find nearest state by centroid
  try {
    const stateRows = (await sql`
      SELECT id, name,
             (6371 * acos(
               LEAST(1, GREATEST(-1,
                 cos(radians(${lat})) * cos(radians(lat))
                 * cos(radians(lng) - radians(${lng}))
                 + sin(radians(${lat})) * sin(radians(lat))
               ))
             )) AS distance_km
      FROM states
      WHERE lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT 1
    `) as unknown as SqlRow[];

    if (stateRows[0]) {
      const s = stateRows[0];
      return {
        state: { id: s.id, name: s.name },
        lga: null,
        ward: null,
        community: null,
        neighborhoodId: null,
        neighborhoodName: null,
        distanceKm: Number(s.distance_km),
        source: "centroid_fallback",
      };
    }
  } catch (err) {
    console.error("[reverse-geocode] State centroid fallback failed:", err);
  }

  return {
    state: null,
    lga: null,
    ward: null,
    community: null,
    neighborhoodId: null,
    neighborhoodName: null,
    distanceKm: null,
    source: "ip_fallback",
  };
}

/**
 * Resolve the full geo hierarchy from a community.
 */
async function resolveHierarchyFromCommunity(
  communityId: number,
  lgaId: number | null,
  stateId: number | null,
  wardId: number | null
): Promise<{
  state: { id: number; name: string } | null;
  lga: { id: number; name: string } | null;
  ward: { id: number; name: string } | null;
  community: { id: number; name: string } | null;
}> {
  const sql = getDb();
  const state = stateId ? ((await sql`SELECT id, name FROM states WHERE id = ${stateId}`) as unknown as SqlRow[])[0] : null;
  const lga = lgaId ? ((await sql`SELECT id, name FROM lgas WHERE id = ${lgaId}`) as unknown as SqlRow[])[0] : null;
  const ward = wardId ? ((await sql`SELECT id, name FROM wards WHERE id = ${wardId}`) as unknown as SqlRow[])[0] : null;
  const community = ((await sql`SELECT id, name FROM communities WHERE id = ${communityId}`) as unknown as SqlRow[])[0];

  return {
    state: state ? { id: state.id, name: state.name } : null,
    lga: lga ? { id: lga.id, name: lga.name } : null,
    ward: ward ? { id: ward.id, name: ward.name } : null,
    community: community ? { id: community.id, name: community.name } : null,
  };
}

/**
 * Resolve the full geo hierarchy from a ward.
 */
async function resolveHierarchyFromWard(
  wardId: number,
  lgaId: number | null,
  stateId: number | null
): Promise<{
  state: { id: number; name: string } | null;
  lga: { id: number; name: string } | null;
  ward: { id: number; name: string } | null;
  community: { id: number; name: string } | null;
}> {
  const sql = getDb();
  const state = stateId ? ((await sql`SELECT id, name FROM states WHERE id = ${stateId}`) as unknown as SqlRow[])[0] : null;
  const lga = lgaId ? ((await sql`SELECT id, name FROM lgas WHERE id = ${lgaId}`) as unknown as SqlRow[])[0] : null;
  const ward = ((await sql`SELECT id, name FROM wards WHERE id = ${wardId}`) as unknown as SqlRow[])[0];

  return {
    state: state ? { id: state.id, name: state.name } : null,
    lga: lga ? { id: lga.id, name: lga.name } : null,
    ward: ward ? { id: ward.id, name: ward.name } : null,
    community: null,
  };
}

/**
 * Populate the geog column for a micro_truths row from report_lat/report_lng.
 * Called after feed creation to ensure spatial indexing works.
 */
export async function populateFeedGeography(truthId: number): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE micro_truths
    SET geog = ST_MakePoint(report_lng, report_lat)::geography
    WHERE id = ${truthId}
      AND report_lat IS NOT NULL
      AND report_lng IS NOT NULL
      AND geog IS NULL
  `;
}

/**
 * Populate the geog column for communities from lat/lng.
 */
export async function populateCommunityGeography(): Promise<{ updated: number }> {
  const sql = getDb();
  const result = (await sql`
    UPDATE communities
    SET geog = ST_MakePoint(lng, lat)::geography
    WHERE lat IS NOT NULL
      AND lng IS NOT NULL
      AND geog IS NULL
    RETURNING id
  `) as unknown as SqlRow[];
  return { updated: result.length };
}
