/**
 * Community Feeds storage layer.
 * ─────────────────────────────────────────────────────────────────────────
 * CRUD + scope-based retrieval for the `feeds` table. Each feed is scoped to a
 * Nigerian geo-hierarchy (state → LGA → ward → community). The `scope` query
 * powers the feeds-page tabs (Near You / Community / Ward / LGA / State / All).
 *
 * Nearby ("near" scope) queries use PostGIS ST_DWithin when the `geog` column
 * exists; otherwise they fall back to a Haversine distance computed in SQL.
 */

import { getDb } from "@/lib/db";
import type { ListFeedsQuery } from "@shared/schema";
import { haversineKm } from "@/lib/geo-reverse";

export interface FeedRow {
  id: number;
  userHash: string;
  clerkUserId: string | null;
  content: string;
  category: string;
  tags: string[];
  mediaUrls: string[];
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  communityId: number | null;
  stateName: string | null;
  lgaName: string | null;
  wardName: string | null;
  communityName: string | null;
  regionName: string | null;
  lat: number | null;
  lng: number | null;
  locationSource: string | null;
  assignmentConfidence: number;
  aiCommunityPrediction: unknown;
  aiRelevanceScore: number;
  spamScore: number;
  spamVerdict: string;
  duplicateOfId: number | null;
  trustScore: number;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  distanceKm?: number | null;
  isAuthor?: boolean;
  authorName?: string | null;
  authorAvatar?: string | null;
}

function parseJsonArr(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRow(r: any): FeedRow {
  return {
    id: r.id,
    userHash: r.user_hash,
    clerkUserId: r.clerk_user_id ?? null,
    content: r.content,
    category: r.category,
    tags: parseJsonArr(r.tags),
    mediaUrls: parseJsonArr(r.media_urls),
    stateId: r.state_id ?? null,
    lgaId: r.lga_id ?? null,
    wardId: r.ward_id ?? null,
    communityId: r.community_id ?? null,
    stateName: r.state_name ?? null,
    lgaName: r.lga_name ?? null,
    wardName: r.ward_name ?? null,
    communityName: r.community_name ?? null,
    regionName: r.region_name ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    locationSource: r.location_source ?? null,
    assignmentConfidence: r.assignment_confidence ?? 0,
    aiCommunityPrediction: r.ai_community_prediction ?? null,
    aiRelevanceScore: r.ai_relevance_score ?? 50,
    spamScore: r.spam_score ?? 0,
    spamVerdict: r.spam_verdict ?? "clean",
    duplicateOfId: r.duplicate_of_id ?? null,
    trustScore: r.trust_score ?? 50,
    likeCount: r.like_count ?? 0,
    commentCount: r.comment_count ?? 0,
    viewCount: r.view_count ?? 0,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    distanceKm: r.distance_km != null ? Number(r.distance_km) : null,
    authorName: r.author_name ?? null,
    authorAvatar: r.author_avatar ?? null,
  };
}

const SELECT_COLS = [
  "f.id", "f.user_hash", "f.clerk_user_id", "f.content", "f.category", "f.tags", "f.media_urls",
  "f.state_id", "f.lga_id", "f.ward_id", "f.community_id", "f.state_name", "f.lga_name",
  "f.ward_name", "f.community_name", "f.region_name", "f.lat", "f.lng", "f.location_source",
  "f.assignment_confidence", "f.ai_community_prediction", "f.ai_relevance_score",
  "f.spam_score", "f.spam_verdict", "f.duplicate_of_id", "f.trust_score", "f.like_count",
  "f.comment_count", "f.view_count", "f.status", "f.created_at", "f.updated_at",
  "u.display_name AS author_name", "u.avatar_url AS author_avatar",
].join(", ");

// ─── Create ────────────────────────────────────────────────────────────────

export interface CreateFeedRecord {
  userHash: string;
  clerkUserId: string | null;
  content: string;
  category: string;
  tags: string[];
  mediaUrls: string[];
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  communityId: number | null;
  stateName: string | null;
  lgaName: string | null;
  wardName: string | null;
  communityName: string | null;
  regionName: string | null;
  lat: number | null;
  lng: number | null;
  locationSource: string;
  assignmentConfidence: number;
  aiCommunityPrediction: unknown;
  aiRelevanceScore: number;
  spamScore: number;
  spamVerdict: string;
  trustScore: number;
  status: string;
}

export async function createFeed(rec: CreateFeedRecord): Promise<FeedRow> {
  const sql = getDb();
  const rows = (await sql`
    INSERT INTO feeds (
      user_hash, clerk_user_id, content, category, tags, media_urls,
      state_id, lga_id, ward_id, community_id, state_name, lga_name,
      ward_name, community_name, region_name, lat, lng, location_source,
      assignment_confidence, ai_community_prediction, ai_relevance_score,
      spam_score, spam_verdict, trust_score, status
    ) VALUES (
      ${rec.userHash}, ${rec.clerkUserId}, ${rec.content}, ${rec.category},
      ${JSON.stringify(rec.tags)}::jsonb, ${JSON.stringify(rec.mediaUrls)}::jsonb,
      ${rec.stateId}, ${rec.lgaId}, ${rec.wardId}, ${rec.communityId},
      ${rec.stateName}, ${rec.lgaName}, ${rec.wardName}, ${rec.communityName},
      ${rec.regionName}, ${rec.lat}, ${rec.lng}, ${rec.locationSource},
      ${rec.assignmentConfidence},
      ${rec.aiCommunityPrediction ? JSON.stringify(rec.aiCommunityPrediction) : null}::jsonb,
      ${rec.aiRelevanceScore}, ${rec.spamScore}, ${rec.spamVerdict},
      ${rec.trustScore}, ${rec.status}
    )
    RETURNING *
  `) as unknown as any[];

  // Best-effort: populate the PostGIS geography column if it exists.
  if (rec.lat != null && rec.lng != null) {
    try {
      await sql`UPDATE feeds SET geog = ST_MakePoint(${rec.lng}, ${rec.lat})::geography WHERE id = ${rows[0].id} AND geog IS NULL`;
    } catch {
      // PostGIS column not present — lat/lng already stored.
    }
  }

  const withAuthor = await attachAuthor(rows[0]);
  return mapRow(withAuthor);
}

async function attachAuthor(row: any): Promise<any> {
  if (!row) return row;
  const sql = getDb();
  const u = (await sql`SELECT display_name, avatar_url FROM platform_users WHERE user_hash = ${row.user_hash} LIMIT 1`) as unknown as any[];
  return { ...row, author_name: u?.[0]?.display_name ?? null, author_avatar: u?.[0]?.avatar_url ?? null };
}

// ─── List (scope-based) ────────────────────────────────────────────────────

/**
 * Retrieve feeds by scope. Manual dropdown filters (state/lga/ward/community)
 * refine or override the active tab. For "near" we require lat/lng and sort
 * by distance (PostGIS ST_DWithin when available, Haversine fallback).
 */
export async function listFeeds(
  q: ListFeedsQuery,
  viewerUserHash?: string | null
): Promise<{ feeds: FeedRow[]; total: number; scope: string; postgisUsed: boolean }> {
  const sql = getDb();
  const {
    scope, lat, lng, radiusKm, state, lga, ward, community,
    category, limit, offset, sort,
  } = q;

  const hasCoords =
    typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng);

  // Build WHERE clauses with $N placeholders + a parallel params array.
  // lat/lng/limit/offset are validated numbers and interpolated directly;
  // string filters are bound as parameters to prevent SQL injection.
  const conditions: string[] = ["f.status = 'published'", "f.spam_verdict <> 'blocked'"];
  const params: any[] = [];
  const add = (frag: string, ...vals: any[]) => {
    const indexed = frag.replace(/\?/g, () => {
      params.push(vals.shift());
      return `$${params.length}`;
    });
    conditions.push(indexed);
  };

  if (state) add("(f.state_name ILIKE ? OR f.state_id IN (SELECT id FROM states WHERE name ILIKE ?))", `%${state}%`, state);
  if (lga) add("(f.lga_name ILIKE ? OR f.lga_id IN (SELECT id FROM lgas WHERE name ILIKE ?))", `%${lga}%`, lga);
  if (ward) add("(f.ward_name ILIKE ? OR f.ward_id IN (SELECT id FROM wards WHERE name ILIKE ?))", `%${ward}%`, ward);
  if (community) add("f.community_name ILIKE ?", `%${community}%`);
  if (category) add("f.category = ?", category);

  if (scope === "community" && !community) add("f.community_id IS NOT NULL");
  else if (scope === "ward" && !ward) add("f.ward_id IS NOT NULL");
  else if (scope === "lga" && !lga) add("f.lga_id IS NOT NULL");
  else if (scope === "state" && !state) add("f.state_id IS NOT NULL");

  let postgisUsed = false;
  let orderBy = "f.created_at DESC";
  if (sort === "trending") orderBy = "(f.like_count + f.comment_count * 2) DESC, f.created_at DESC";
  else if (sort === "trust") orderBy = "f.trust_score DESC, f.created_at DESC";

  let distanceExpr = "NULL::numeric AS distance_km";
  if (scope === "near" && hasCoords) {
    try {
      const test = (await sql.query(`SELECT to_regclass('public.idx_feeds_geog') AS exists`)) as unknown as any[];
      postgisUsed = !!test?.[0]?.exists;
    } catch {
      postgisUsed = false;
    }
    if (postgisUsed) {
      distanceExpr = `ST_Distance(f.geog, ST_MakePoint(${lng}, ${lat})::geography) / 1000 AS distance_km`;
      conditions.push(`f.geog IS NOT NULL AND ST_DWithin(f.geog, ST_MakePoint(${lng}, ${lat})::geography, ${radiusKm * 1000})`);
    } else {
      distanceExpr = `(6371 * acos(LEAST(1, GREATEST(-1, cos(radians(${lat})) * cos(radians(f.lat)) * cos(radians(f.lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(f.lat)))))) AS distance_km`;
      conditions.push("f.lat IS NOT NULL AND f.lng IS NOT NULL");
    }
    orderBy = "distance_km ASC";
  }

  const finalWhere = conditions.join(" AND ");
  const query = `
    SELECT ${SELECT_COLS}, ${distanceExpr}
    FROM feeds f
    LEFT JOIN platform_users u ON u.user_hash = f.user_hash
    WHERE ${finalWhere}
    ORDER BY ${orderBy}
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = (await sql.query(query, params)) as unknown as any[];
  let mapped = rows.map(mapRow);
  if (scope === "near" && hasCoords && !postgisUsed) {
    mapped = mapped.filter((r) => r.distanceKm != null && r.distanceKm <= radiusKm);
  }
  if (viewerUserHash) {
    mapped = mapped.map((r) => ({ ...r, isAuthor: r.userHash === viewerUserHash }));
  }

  const countQuery = `SELECT COUNT(*)::int AS total FROM feeds f WHERE ${finalWhere}`;
  const countRows = (await sql.query(countQuery, params)) as unknown as any[];
  const total = countRows?.[0]?.total ?? mapped.length;

  return { feeds: mapped, total, scope, postgisUsed };
}

// ─── Single feed ───────────────────────────────────────────────────────────

export async function getFeedById(id: number, viewerUserHash?: string | null): Promise<FeedRow | null> {
  const sql = getDb();
  const query = `
    SELECT ${SELECT_COLS}, NULL::numeric AS distance_km
    FROM feeds f
    LEFT JOIN platform_users u ON u.user_hash = f.user_hash
    WHERE f.id = $1
    LIMIT 1
  `;
  const rows = (await sql.query(query, [id])) as unknown as any[];
  if (!rows || rows.length === 0) return null;
  const row = mapRow(rows[0]);
  if (viewerUserHash) row.isAuthor = row.userHash === viewerUserHash;
  return row;
}

// ─── Engagement ────────────────────────────────────────────────────────────

export async function incrementFeedView(id: number): Promise<void> {
  const sql = getDb();
  await sql`UPDATE feeds SET view_count = view_count + 1 WHERE id = ${id}`;
}

export async function likeFeed(id: number, userHash: string): Promise<{ liked: boolean; likeCount: number }> {
  const sql = getDb();
  // Community feeds track likes via the counter (no FK to micro_truths).
  await sql`UPDATE feeds SET like_count = like_count + 1 WHERE id = ${id}`;
  const row = (await sql`SELECT like_count FROM feeds WHERE id = ${id}`) as unknown as any[];
  return { liked: true, likeCount: row?.[0]?.like_count ?? 0 };
}

// ─── Trending ──────────────────────────────────────────────────────────────

export interface TrendingTag {
  tag: string;
  count: number;
  trend: "up" | "down" | "stable";
}

export async function getTrendingTags(
  scope: "community" | "ward" | "lga" | "state" | "all",
  filters: { state?: string; lga?: string; ward?: string; community?: string },
  windowHours = 24,
  limit = 10
): Promise<{ tags: TrendingTag[]; scope: string }> {
  const sql = getDb();
  const conditions: string[] = [
    "f.status = 'published'",
    "f.spam_verdict <> 'blocked'",
    `f.created_at >= NOW() - INTERVAL '${Number(windowHours)} hours'`,
  ];
  const params: any[] = [];
  const add = (frag: string, val: any) => {
    conditions.push(frag.replace(/\?/g, () => {
      params.push(val);
      return `$${params.length}`;
    }));
  };
  if (filters.state) add("f.state_name ILIKE ?", `%${filters.state}%`);
  if (filters.lga) add("f.lga_name ILIKE ?", `%${filters.lga}%`);
  if (filters.ward) add("f.ward_name ILIKE ?", `%${filters.ward}%`);
  if (filters.community) add("f.community_name ILIKE ?", `%${filters.community}%`);

  const query = `
    SELECT tag, COUNT(*)::int AS count
    FROM feeds f, jsonb_array_elements_text(f.tags) AS tag
    WHERE ${conditions.join(" AND ")}
    GROUP BY tag
    ORDER BY count DESC
    LIMIT ${limit}
  `;
  const rows = (await sql.query(query, params)) as unknown as any[];
  const tags: TrendingTag[] = (rows || []).map((r, i) => ({
    tag: r.tag,
    count: Number(r.count),
    trend: i === 0 ? "up" : "stable",
  }));
  return { tags, scope };
}

// ─── Geo hierarchy for dropdowns ───────────────────────────────────────────

export async function getFeedHierarchy() {
  const sql = getDb();
  const states = (await sql`SELECT id, name FROM states ORDER BY name`) as unknown as any[];
  const lgas = (await sql`SELECT id, name, state_id FROM lgas ORDER BY name`) as unknown as any[];
  const wards = (await sql`SELECT id, name, lga_id, state_id, lat, lng FROM wards ORDER BY name`) as unknown as any[];
  const communities = (await sql`SELECT id, name, ward_id, lat, lng FROM communities ORDER BY name`) as unknown as any[];

  // Merge with static Nigerian reference data so dropdowns always show all 37
  // states + 774 LGAs even when the DB is not fully seeded.
  const { NIGERIA_STATES, NIGERIA_LGAS } = await import("@/lib/nigeria-locations");
  const stateNames = new Set(states.map((s) => s.name));
  for (const s of NIGERIA_STATES) stateNames.add(s);
  const allStates = [...stateNames].sort();

  const lgasByState: Record<string, string[]> = {};
  for (const l of lgas) {
    const st = states.find((s) => s.id === l.state_id)?.name;
    if (st) (lgasByState[st] ||= []).push(l.name);
  }
  for (const [st, list] of Object.entries(NIGERIA_LGAS)) {
    (lgasByState[st] ||= []).push(...list);
    lgasByState[st] = [...new Set(lgasByState[st])].sort();
  }

  const wardsByLga: Record<string, string[]> = {};
  for (const w of wards) {
    const lga = lgas.find((l) => l.id === w.lga_id);
    if (lga) {
      const st = states.find((s) => s.id === lga.state_id)?.name;
      const key = `${st}|${lga.name}`;
      (wardsByLga[key] ||= []).push(w.name);
    }
  }

  const communitiesByWard: Record<string, string[]> = {};
  for (const c of communities) {
    const ward = wards.find((w) => w.id === c.ward_id);
    if (ward) {
      const lga = lgas.find((l) => l.id === ward.lga_id);
      const st = lga ? states.find((s) => s.id === lga.state_id)?.name : null;
      const key = `${st}|${lga?.name}|${ward.name}`;
      (communitiesByWard[key] ||= []).push(c.name);
    }
  }

  return {
    states: allStates,
    lgasByState,
    wardsByLga,
    communitiesByWard,
    dbStates: states.map((s) => ({ id: s.id, name: s.name })),
    dbLgas: lgas.map((l) => ({ id: l.id, name: l.name, stateId: l.state_id })),
    dbWards: wards.map((w) => ({ id: w.id, name: w.name, lgaId: w.lga_id, stateId: w.state_id, lat: w.lat, lng: w.lng })),
    dbCommunities: communities.map((c) => ({ id: c.id, name: c.name, wardId: c.ward_id, lat: c.lat, lng: c.lng })),
  };
}

export { haversineKm };
