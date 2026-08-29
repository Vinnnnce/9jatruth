/**
 * Community Feeds Service
 *
 * Provides feed query functions for the 6-tab community feeds system:
 *   - Near You (geo-spatial radius query via PostGIS)
 *   - Your Community (by community_id)
 *   - Your Ward (by ward_id)
 *   - Your LGA (by lga_id)
 *   - Your State (by state_id)
 *   - All Nigeria (no geo filter)
 *
 * Also provides cascading geo data retrieval for dropdown filters:
 *   - getStates() → getLgasByState(stateId) → getWardsByLga(lgaId) → getCommunitiesByWard(wardId)
 */

import { getDb } from "@/lib/db";

type SqlRow = Record<string, any>;

export type GeoLevel = "near_you" | "community" | "ward" | "lga" | "state" | "all_nigeria";

export interface CommunityFeed {
  id: number;
  category: string;
  content: string;
  trustScore: number;
  status: string;
  createdAt: string;
  userHash: string;
  organizationId: number | null;
  reportLat: number | null;
  reportLng: number | null;
  locationSource: string | null;
  stateName: string | null;
  lgaName: string | null;
  communityName: string | null;
  villageName: string | null;
  regionName: string | null;
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  communityId: number | null;
  aiTags: string[];
  aiCategory: string | null;
  aiSpamScore: number;
  aiSpamFlags: string[];
  trendingScore: number;
  orgName: string | null;
  orgVerified: boolean;
  neighborhoodName: string | null;
  displayName: string | null;
  username: string | null;
  distanceKm: number | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  verificationCount: number;
  isAuthor: boolean;
}

export interface FeedQueryOptions {
  level: GeoLevel;
  stateId?: number | null;
  lgaId?: number | null;
  wardId?: number | null;
  communityId?: number | null;
  stateName?: string | null;
  lgaName?: string | null;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  category?: string;
  limit?: number;
  offset?: number;
  sortBy?: "recent" | "nearest" | "trending" | "trust";
  userHash?: string | null;
}

const BASE_SELECT = `
  t.id, t.category, t.content, t.trust_score, t.status, t.created_at,
  t.user_hash, t.organization_id, t.report_lat, t.report_lng, t.location_source,
  t.state_name, t.lga_name, t.community_name, t.village_name, t.region_name,
  t.state_id, t.lga_id, t.ward_id, t.community_id,
  t.ai_tags, t.ai_category, t.ai_spam_score, t.ai_spam_flags, t.trending_score,
  o.name AS org_name, o.verified AS org_verified,
  n.name AS neighborhood_name,
  u.display_name, u.username,
  COALESCE(like_counts.cnt, 0) AS like_count,
  COALESCE(comment_counts.cnt, 0) AS comment_count,
  COALESCE(share_counts.cnt, 0) AS share_count,
  COALESCE(verification_counts.cnt, 0) AS verification_count
`;

const JOINS = `
  FROM micro_truths t
  LEFT JOIN organizations o ON t.organization_id = o.id
  LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id
  LEFT JOIN platform_users u ON t.user_hash = u.clerk_user_id
  LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_likes WHERE deleted_at IS NULL GROUP BY truth_id) like_counts ON like_counts.truth_id = t.id
  LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_comments WHERE deleted_at IS NULL GROUP BY truth_id) comment_counts ON comment_counts.truth_id = t.id
  LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM feed_shares GROUP BY truth_id) share_counts ON share_counts.truth_id = t.id
  LEFT JOIN (SELECT truth_id, COUNT(*) AS cnt FROM verifications GROUP BY truth_id) verification_counts ON verification_counts.truth_id = t.id
`;

function mapFeedRow(r: SqlRow, viewerHash?: string | null): CommunityFeed {
  let aiTags: string[] = [];
  let aiSpamFlags: string[] = [];
  try { aiTags = JSON.parse(r.ai_tags || "[]"); } catch { /* ignore */ }
  try { aiSpamFlags = JSON.parse(r.ai_spam_flags || "[]"); } catch { /* ignore */ }
  return {
    id: r.id,
    category: r.category,
    content: r.content,
    trustScore: r.trust_score ?? 50,
    status: r.status ?? "pending",
    createdAt: r.created_at,
    userHash: r.user_hash,
    organizationId: r.organization_id ?? null,
    reportLat: r.report_lat ?? null,
    reportLng: r.report_lng ?? null,
    locationSource: r.location_source ?? null,
    stateName: r.state_name ?? null,
    lgaName: r.lga_name ?? null,
    communityName: r.community_name ?? null,
    villageName: r.village_name ?? null,
    regionName: r.region_name ?? null,
    stateId: r.state_id ?? null,
    lgaId: r.lga_id ?? null,
    wardId: r.ward_id ?? null,
    communityId: r.community_id ?? null,
    aiTags,
    aiCategory: r.ai_category ?? null,
    aiSpamScore: r.ai_spam_score ?? 0,
    aiSpamFlags,
    trendingScore: r.trending_score ?? 0,
    orgName: r.org_name ?? null,
    orgVerified: r.org_verified === 1 || r.org_verified === true,
    neighborhoodName: r.neighborhood_name ?? null,
    displayName: r.display_name ?? null,
    username: r.username ?? null,
    distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
    likeCount: r.like_count ?? 0,
    commentCount: r.comment_count ?? 0,
    shareCount: r.share_count ?? 0,
    verificationCount: r.verification_count ?? 0,
    isAuthor: !!(viewerHash && r.user_hash === viewerHash),
  };
}

function buildOrderBy(sortBy: string): string {
  switch (sortBy) {
    case "trust": return "t.trust_score DESC, t.created_at DESC";
    case "trending": return "t.trending_score DESC, t.created_at DESC";
    case "nearest": return "distance_km ASC, t.created_at DESC";
    default: return "t.created_at DESC";
  }
}

/**
 * Main feed query function — routes to the appropriate geo-level query.
 */
export async function getCommunityFeeds(opts: FeedQueryOptions): Promise<{ feeds: CommunityFeed[]; total: number }> {
  const sql = getDb();
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const sortBy = opts.sortBy ?? "recent";
  const viewerHash = opts.userHash ?? null;
  const category = opts.category ?? null;

  let whereClause = "t.deleted_at IS NULL AND t.status <> 'rejected'";
  const params: any[] = [];
  let paramIdx = 1;
  let useDistance = false;

  // Category filter
  if (category) {
    whereClause += ` AND t.category = $${paramIdx++}`;
    params.push(category);
  }

  switch (opts.level) {
    case "community":
      if (opts.communityId) {
        whereClause += ` AND t.community_id = $${paramIdx++}`;
        params.push(opts.communityId);
      } else if (opts.wardId) {
        whereClause += ` AND (t.community_id IS NOT NULL AND t.community_id IN (SELECT id FROM communities WHERE ward_id = $${paramIdx++}))`;
        params.push(opts.wardId);
      } else if (opts.lgaId) {
        whereClause += ` AND (t.community_id IS NOT NULL AND t.community_id IN (SELECT id FROM communities WHERE lga_id = $${paramIdx++}))`;
        params.push(opts.lgaId);
      } else if (opts.stateId) {
        whereClause += ` AND (t.community_id IS NOT NULL AND t.community_id IN (SELECT id FROM communities WHERE state_id = $${paramIdx++}))`;
        params.push(opts.stateId);
      } else {
        // Fallback to state_name text match
        whereClause += ` AND t.community_name IS NOT NULL`;
      }
      break;

    case "ward":
      if (opts.wardId) {
        whereClause += ` AND t.ward_id = $${paramIdx++}`;
        params.push(opts.wardId);
      } else if (opts.lgaId) {
        whereClause += ` AND t.ward_id IN (SELECT id FROM wards WHERE lga_id = $${paramIdx++})`;
        params.push(opts.lgaId);
      } else if (opts.stateId) {
        whereClause += ` AND t.ward_id IN (SELECT id FROM wards WHERE state_id = $${paramIdx++})`;
        params.push(opts.stateId);
      }
      break;

    case "lga":
      if (opts.lgaId) {
        whereClause += ` AND t.lga_id = $${paramIdx++}`;
        params.push(opts.lgaId);
      } else if (opts.stateId) {
        whereClause += ` AND t.lga_id IN (SELECT id FROM lgas WHERE state_id = $${paramIdx++})`;
        params.push(opts.stateId);
      } else if (opts.lgaName) {
        whereClause += ` AND t.lga_name = $${paramIdx++}`;
        params.push(opts.lgaName as any);
      }
      break;

    case "state":
      if (opts.stateId) {
        whereClause += ` AND t.state_id = $${paramIdx++}`;
        params.push(opts.stateId);
      } else if (opts.stateName) {
        whereClause += ` AND t.state_name = $${paramIdx++}`;
        params.push(opts.stateName as any);
      }
      break;

    case "near_you":
      if (opts.lat != null && opts.lng != null) {
        useDistance = true;
        const radiusMeters = (opts.radiusKm ?? 5) * 1000;
        whereClause += ` AND t.geog IS NOT NULL AND ST_DWithin(t.geog, ST_MakePoint($${paramIdx}, $${paramIdx + 1})::geography, $${paramIdx + 2})`;
        params.push(opts.lng, opts.lat, radiusMeters);
        paramIdx += 3;
      } else {
        // Fallback: no location, return recent posts
        whereClause += ` AND t.state_id IS NOT NULL`;
      }
      break;

    case "all_nigeria":
    default:
      // No additional geo filter
      break;
  }

  const distanceSelect = useDistance
    ? `, ST_Distance(t.geog, ST_MakePoint($${paramIdx}, $${paramIdx + 1})::geography) / 1000 AS distance_km`
    : "";
  if (useDistance) {
    params.push(opts.lng, opts.lat);
    paramIdx += 2;
  }

  const orderBy = useDistance && sortBy === "nearest" ? "distance_km ASC, t.created_at DESC" : buildOrderBy(sortBy);

  // Count total for pagination
  const countQuery = `SELECT COUNT(*) AS total ${JOINS} WHERE ${whereClause}`;
  const countResult = (await sql.query(countQuery, params)) as unknown as SqlRow[];
  const total = countResult[0]?.total ? Number(countResult[0].total) : 0;

  // Main query
  const limitParam = `$${paramIdx++}`;
  const offsetParam = `$${paramIdx++}`;
  params.push(limit, offset);

  const mainQuery = `SELECT ${BASE_SELECT}${distanceSelect} ${JOINS} WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ${limitParam} OFFSET ${offsetParam}`;
  const rows = (await sql.query(mainQuery, params)) as unknown as SqlRow[];

  return {
    feeds: rows.map((r) => mapFeedRow(r, viewerHash)),
    total,
  };
}

// ─── Cascading Geo Data for Dropdowns ───

export interface GeoOption {
  id: number;
  name: string;
  lat?: number | null;
  lng?: number | null;
}

export async function getStates(): Promise<GeoOption[]> {
  const sql = getDb();
  const rows = (await sql`SELECT id, name, lat, lng FROM states ORDER BY name`) as unknown as SqlRow[];
  return rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng }));
}

export async function getLgasByState(stateId: number): Promise<GeoOption[]> {
  const sql = getDb();
  const rows = (await sql`SELECT id, name, lat, lng FROM lgas WHERE state_id = ${stateId} ORDER BY name`) as unknown as SqlRow[];
  return rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng }));
}

export async function getWardsByLga(lgaId: number): Promise<GeoOption[]> {
  const sql = getDb();
  const rows = (await sql`SELECT id, name, lat, lng FROM wards WHERE lga_id = ${lgaId} ORDER BY name`) as unknown as SqlRow[];
  return rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng }));
}

export async function getCommunitiesByWard(wardId: number): Promise<GeoOption[]> {
  const sql = getDb();
  const rows = (await sql`SELECT id, name, lat, lng FROM communities WHERE ward_id = ${wardId} ORDER BY name`) as unknown as SqlRow[];
  return rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng }));
}

export async function getCommunitiesByLga(lgaId: number): Promise<GeoOption[]> {
  const sql = getDb();
  const rows = (await sql`SELECT id, name, lat, lng FROM communities WHERE lga_id = ${lgaId} ORDER BY name`) as unknown as SqlRow[];
  return rows.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lng: r.lng }));
}

/**
 * Get the full geo hierarchy path for a given community/ward/lga/state ID.
 */
export async function getGeoPath(opts: {
  stateId?: number | null;
  lgaId?: number | null;
  wardId?: number | null;
  communityId?: number | null;
}): Promise<{
  state: GeoOption | null;
  lga: GeoOption | null;
  ward: GeoOption | null;
  community: GeoOption | null;
}> {
  const sql = getDb();
  let state: GeoOption | null = null;
  let lga: GeoOption | null = null;
  let ward: GeoOption | null = null;
  let community: GeoOption | null = null;

  if (opts.communityId) {
    const rows = (await sql`SELECT id, name, lat, lng FROM communities WHERE id = ${opts.communityId}`) as unknown as SqlRow[];
    if (rows[0]) community = { id: rows[0].id, name: rows[0].name, lat: rows[0].lat, lng: rows[0].lng };
  }
  if (opts.wardId) {
    const rows = (await sql`SELECT id, name, lat, lng FROM wards WHERE id = ${opts.wardId}`) as unknown as SqlRow[];
    if (rows[0]) ward = { id: rows[0].id, name: rows[0].name, lat: rows[0].lat, lng: rows[0].lng };
  }
  if (opts.lgaId) {
    const rows = (await sql`SELECT id, name, lat, lng FROM lgas WHERE id = ${opts.lgaId}`) as unknown as SqlRow[];
    if (rows[0]) lga = { id: rows[0].id, name: rows[0].name, lat: rows[0].lat, lng: rows[0].lng };
  }
  if (opts.stateId) {
    const rows = (await sql`SELECT id, name, lat, lng FROM states WHERE id = ${opts.stateId}`) as unknown as SqlRow[];
    if (rows[0]) state = { id: rows[0].id, name: rows[0].name, lat: rows[0].lat, lng: rows[0].lng };
  }

  return { state, lga, ward, community };
}

/**
 * Create a community feed post with geo hierarchy assignment.
 */
export async function createCommunityFeed(data: {
  neighborhoodId: number;
  category: string;
  content: string;
  userHash: string;
  reportLat?: number | null;
  reportLng?: number | null;
  locationSource?: string;
  organizationId?: number | null;
  stateId?: number | null;
  lgaId?: number | null;
  wardId?: number | null;
  communityId?: number | null;
  stateName?: string | null;
  lgaName?: string | null;
  communityName?: string | null;
  villageName?: string | null;
  regionName?: string | null;
  aiTags?: string[];
  aiCategory?: string | null;
  aiSpamScore?: number;
  aiSpamFlags?: string[];
}): Promise<CommunityFeed | null> {
  const sql = getDb();
  const geog = (data.reportLat != null && data.reportLng != null)
    ? sql`ST_MakePoint(${data.reportLng}, ${data.reportLat})::geography`
    : null;

  const rows = (await sql`
    INSERT INTO micro_truths (
      neighborhood_id, category, content, user_hash,
      report_lat, report_lng, location_source,
      organization_id,
      state_id, lga_id, ward_id, community_id,
      state_name, lga_name, community_name, village_name, region_name,
      ai_tags, ai_category, ai_spam_score, ai_spam_flags,
      geog
    ) VALUES (
      ${data.neighborhoodId}, ${data.category}, ${data.content}, ${data.userHash},
      ${data.reportLat ?? null}, ${data.reportLng ?? null}, ${data.locationSource ?? null},
      ${data.organizationId ?? null},
      ${data.stateId ?? null}, ${data.lgaId ?? null}, ${data.wardId ?? null}, ${data.communityId ?? null},
      ${data.stateName ?? null}, ${data.lgaName ?? null}, ${data.communityName ?? null}, ${data.villageName ?? null}, ${data.regionName ?? null},
      ${JSON.stringify(data.aiTags || [])}, ${data.aiCategory ?? null}, ${data.aiSpamScore ?? 0}, ${JSON.stringify(data.aiSpamFlags || [])},
      ${geog}
    )
    RETURNING *
  `) as unknown as SqlRow[];

  if (!rows[0]) return null;
  return mapFeedRow(rows[0]);
}
