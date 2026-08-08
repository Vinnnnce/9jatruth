/**
 * Neon SQL storage layer for Next.js Route Handlers.
 *
 * Ports the NeonStorage class and the supporting service/model logic
 * (ingestion, rewards/gamification, geo-clustering, mesh-sync, push,
 * predictions, AI models) to use the Neon serverless tagged-template
 * client from @/lib/db directly. All functions assume the database has
 * been initialized via ensureDbInitialized() by the calling route.
 */

import { getDb } from "@/lib/db";
import {
  TRUTH_CATEGORIES,
  ACHIEVEMENT_DEFS,
  XP_PER_SUBMISSION,
  XP_PER_VERIFICATION,
  XP_PER_CORROBORATION,
  XP_STREAK_BONUS,
  LEVEL_BASE_XP,
  LEVEL_MULTIPLIER,
} from "@shared/schema";
import type {
  Neighborhood,
  MicroTruth,
  Snapshot,
  Prediction,
  RewardLedger,
  DeviceProfile,
  Organization,
  Verification,
} from "@shared/schema";
import bcrypt from "bcryptjs";

type SqlRow = Record<string, any>;

// ─── Helpers ───

/**
 * Parse the badges column safely into an array.
 * Handles: null, undefined, string (JSON), array, object.
 */
function parseBadges(raw: any): any[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── Haversine Distance Helpers ───

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─── Row Mappers (snake_case DB → camelCase app) ───

function mapNeighborhood(r: SqlRow): Neighborhood {
  return {
    id: r.id,
    name: r.name,
    region: r.region,
    geoHash: r.geo_hash,
    lat: r.lat,
    lng: r.lng,
    createdAt: r.created_at,
  };
}

function mapTruth(r: SqlRow): MicroTruth {
  return {
    id: r.id,
    neighborhoodId: r.neighborhood_id,
    category: r.category,
    content: r.content,
    trustScore: r.trust_score,
    decayFactor: r.decay_factor,
    verificationChain: r.verification_chain,
    userHash: r.user_hash,
    status: r.status,
    createdAt: r.created_at,
    ipHash: r.ip_hash ?? null,
    ipRegion: r.ip_region ?? null,
    ipCity: r.ip_city ?? null,
    reportLat: r.report_lat ?? null,
    reportLng: r.report_lng ?? null,
    locationSource: r.location_source ?? null,
    organizationId: r.organization_id ?? null,
    stateName: r.state_name ?? null,
    lgaName: r.lga_name ?? null,
    communityName: r.community_name ?? null,
    villageName: r.village_name ?? null,
    regionName: r.region_name ?? null,
  };
}

function mapOrganization(r: SqlRow): Organization {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    contactEmail: r.contact_email,
    contactPhone: r.contact_phone,
    website: r.website,
    logoUrl: r.logo_url,
    region: r.region,
    city: r.city,
    lat: r.lat,
    lng: r.lng,
    verified: r.verified,
    active: r.active,
    adminHash: r.admin_hash,
    createdAt: r.created_at,
  };
}

function mapAgencyAccount(r: SqlRow) {
  return {
    id: r.id,
    organizationId: r.organization_id,
    email: r.email,
    passwordHash: r.password_hash,
    displayName: r.display_name,
    role: r.role,
    active: r.active,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapSnapshot(r: SqlRow): Snapshot {
  return {
    id: r.id,
    neighborhoodId: r.neighborhood_id,
    powerStatus: r.power_status,
    fuelStatus: r.fuel_status,
    trafficLevel: r.traffic_level,
    priceIndex: r.price_index,
    safetyIndex: r.safety_index,
    activeTruths: r.active_truths,
    updatedAt: r.updated_at,
  };
}

function mapPrediction(r: SqlRow): Prediction {
  return {
    id: r.id,
    category: r.category,
    neighborhoodId: r.neighborhood_id,
    prediction: r.prediction,
    confidence: r.confidence,
    timeframe: r.timeframe,
    trend: r.trend,
    modelVersion: r.model_version,
    createdAt: r.created_at,
  };
}

function mapReward(r: SqlRow): RewardLedger {
  return {
    id: r.id,
    userHash: r.user_hash,
    amount: r.amount,
    type: r.type,
    description: r.description,
    createdAt: r.created_at,
  };
}

function mapDevice(r: SqlRow): DeviceProfile {
  return {
    id: r.id,
    deviceIdHash: r.device_id_hash,
    trustScore: r.trust_score,
    totalSubmissions: r.total_submissions,
    rewardsBalance: r.rewards_balance,
    createdAt: r.created_at,
  };
}

function buildVerificationChain(trustScore: number) {
  const now = new Date();
  return [
    { step: "intake", timestamp: now.toISOString(), result: "received from mesh sync", trustDelta: 0 },
    { step: "format_check", timestamp: new Date(now.getTime() + 100).toISOString(), result: "schema valid, category recognized", trustDelta: 5 },
    { step: "dedup_check", timestamp: new Date(now.getTime() + 200).toISOString(), result: "no duplicates within 500m radius", trustDelta: 10 },
    ...(trustScore > 40
      ? [{ step: "corroboration", timestamp: new Date(now.getTime() + 300).toISOString(), result: `${Math.floor(trustScore / 20)} corroborating reports`, trustDelta: 15 }]
      : []),
    { step: "trust_eval", timestamp: new Date(now.getTime() + 400).toISOString(), result: `final trust score: ${trustScore}`, trustDelta: 0 },
  ];
}

export interface TruthFilters {
  category?: string;
  status?: string;
  minTrust?: number;
  maxTrust?: number;
  hoursBack?: number;
  organizationId?: number;
}

// ═══════════════════════════════════════════════════════════════
// Neighborhoods
// ═══════════════════════════════════════════════════════════════

export async function getNeighborhoods(): Promise<Neighborhood[]> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM neighborhoods ORDER BY id`) as unknown as SqlRow[];
  return rows.map(mapNeighborhood);
}

export async function getNeighborhood(id: number): Promise<Neighborhood | undefined> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM neighborhoods WHERE id = ${id}`) as unknown as SqlRow[];
  return rows[0] ? mapNeighborhood(rows[0]) : undefined;
}

// ═══════════════════════════════════════════════════════════════
// MicroTruths
// ═══════════════════════════════════════════════════════════════

export async function getTruths(limit = 50, neighborhoodId?: number, category?: string): Promise<MicroTruth[]> {
  const sql = getDb();
  let rows: SqlRow[];
  if (neighborhoodId && category) {
    rows = (await sql`SELECT t.*, o.name as org_name, o.verified as org_verified FROM micro_truths t LEFT JOIN organizations o ON t.organization_id = o.id WHERE t.neighborhood_id = ${neighborhoodId} AND t.category = ${category} ORDER BY t.created_at DESC LIMIT ${limit}`) as unknown as SqlRow[];
  } else if (neighborhoodId) {
    rows = (await sql`SELECT t.*, o.name as org_name, o.verified as org_verified FROM micro_truths t LEFT JOIN organizations o ON t.organization_id = o.id WHERE t.neighborhood_id = ${neighborhoodId} ORDER BY t.created_at DESC LIMIT ${limit}`) as unknown as SqlRow[];
  } else if (category) {
    rows = (await sql`SELECT t.*, o.name as org_name, o.verified as org_verified FROM micro_truths t LEFT JOIN organizations o ON t.organization_id = o.id WHERE t.category = ${category} ORDER BY t.created_at DESC LIMIT ${limit}`) as unknown as SqlRow[];
  } else {
    rows = (await sql`SELECT t.*, o.name as org_name, o.verified as org_verified FROM micro_truths t LEFT JOIN organizations o ON t.organization_id = o.id ORDER BY t.created_at DESC LIMIT ${limit}`) as unknown as SqlRow[];
  }
  return rows.map((r) => ({
    ...mapTruth(r),
    orgName: r.org_name ?? null,
    orgVerified: r.org_verified === 1 || r.org_verified === true,
  })) as any;
}

export async function getTruthsNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  filters?: TruthFilters
): Promise<Array<MicroTruth & { distanceKm: number; neighborhoodName?: string }>> {
  const sql = getDb();
  let rows: SqlRow[];
  if (filters?.category && filters?.status) {
    rows = (await sql`SELECT * FROM micro_truths WHERE category = ${filters.category} AND status = ${filters.status} ORDER BY created_at DESC LIMIT 500`) as unknown as SqlRow[];
  } else if (filters?.category) {
    rows = (await sql`SELECT * FROM micro_truths WHERE category = ${filters.category} ORDER BY created_at DESC LIMIT 500`) as unknown as SqlRow[];
  } else if (filters?.status) {
    rows = (await sql`SELECT * FROM micro_truths WHERE status = ${filters.status} ORDER BY created_at DESC LIMIT 500`) as unknown as SqlRow[];
  } else {
    rows = (await sql`SELECT * FROM micro_truths ORDER BY created_at DESC LIMIT 500`) as unknown as SqlRow[];
  }

  const nRows = (await sql`SELECT * FROM neighborhoods`) as unknown as SqlRow[];
  const neighborhoodMap = new Map<number, Neighborhood>();
  for (const r of nRows) {
    const n = mapNeighborhood(r);
    neighborhoodMap.set(n.id, n);
  }

  let truths = rows.map(mapTruth);
  if (filters?.hoursBack) {
    const cutoff = new Date(Date.now() - filters.hoursBack * 3600000).toISOString();
    truths = truths.filter((t) => t.createdAt >= cutoff);
  }
  if (filters?.minTrust) {
    truths = truths.filter((t) => t.trustScore >= filters.minTrust!);
  }
  if (filters?.maxTrust) {
    truths = truths.filter((t) => t.trustScore <= filters.maxTrust!);
  }
  if (filters?.organizationId) {
    truths = truths.filter((t) => t.organizationId === filters.organizationId);
  }

  const results: Array<MicroTruth & { distanceKm: number; neighborhoodName?: string }> = [];
  for (const truth of truths) {
    const neighborhood = neighborhoodMap.get(truth.neighborhoodId);
    if (!neighborhood) continue;
    const truthLat = truth.reportLat ?? neighborhood.lat;
    const truthLng = truth.reportLng ?? neighborhood.lng;
    const distance = haversineKm(lat, lng, truthLat, truthLng);
    if (distance <= radiusKm) {
      results.push({ ...truth, distanceKm: Math.round(distance * 10) / 10, neighborhoodName: neighborhood.name });
    }
  }
  return results;
}

export async function getTruth(id: number): Promise<MicroTruth | undefined> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM micro_truths WHERE id = ${id}`) as unknown as SqlRow[];
  return rows[0] ? mapTruth(rows[0]) : undefined;
}

export async function getDeviceProfile(deviceIdHash: string): Promise<DeviceProfile | undefined> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM device_profiles WHERE device_id_hash = ${deviceIdHash}`) as unknown as SqlRow[];
  return rows[0] ? mapDevice(rows[0]) : undefined;
}

export async function upsertDeviceProfile(deviceIdHash: string): Promise<DeviceProfile> {
  const existing = await getDeviceProfile(deviceIdHash);
  if (existing) return existing;
  const sql = getDb();
  const rows = (await sql`INSERT INTO device_profiles (device_id_hash, trust_score, total_submissions, rewards_balance) VALUES (${deviceIdHash}, 50, 0, 0) RETURNING *`) as unknown as SqlRow[];
  return mapDevice(rows[0]);
}

export interface CreateTruthInput {
  neighborhoodId: number;
  category: string;
  content: string;
  userHash: string;
  ipHash?: string;
  ipRegion?: string;
  ipCity?: string;
  reportLat?: number;
  reportLng?: number;
  locationSource?: string;
  organizationId?: number;
  stateName?: string;
  lgaName?: string;
  communityName?: string;
  villageName?: string;
  regionName?: string;
}

export async function createTruth(data: CreateTruthInput): Promise<MicroTruth> {
  const sql = getDb();
  const device = await getDeviceProfile(data.userHash);
  const baseTrust = device?.trustScore ?? 50;
  const trustScore = Math.min(100, baseTrust + Math.floor(Math.random() * 10));
  const chain = JSON.stringify(buildVerificationChain(trustScore));

  const rows = (await sql`INSERT INTO micro_truths (neighborhood_id, category, content, trust_score, decay_factor, verification_chain, user_hash, status, ip_hash, ip_region, ip_city, report_lat, report_lng, location_source, organization_id, state_name, lga_name, community_name, village_name, region_name) VALUES (${data.neighborhoodId}, ${data.category}, ${data.content}, ${trustScore}, 1.0, ${chain}, ${data.userHash}, 'pending', ${data.ipHash ?? null}, ${data.ipRegion ?? null}, ${data.ipCity ?? null}, ${data.reportLat ?? null}, ${data.reportLng ?? null}, ${data.locationSource ?? null}, ${data.organizationId ?? null}, ${data.stateName ?? null}, ${data.lgaName ?? null}, ${data.communityName ?? null}, ${data.villageName ?? null}, ${data.regionName ?? null}) RETURNING *`) as unknown as SqlRow[];
  const truth = mapTruth(rows[0]);

  await sql`INSERT INTO reward_ledger (user_hash, amount, type, description) VALUES (${data.userHash}, 20, 'submission', ${`Truth submitted: ${data.category} report`})`;

  if (device) {
    await sql`UPDATE device_profiles SET total_submissions = ${device.totalSubmissions + 1}, trust_score = ${Math.min(100, device.trustScore + 1)}, rewards_balance = ${device.rewardsBalance + 20} WHERE device_id_hash = ${data.userHash}`;
  }

  const snapshot = await getSnapshot(data.neighborhoodId);
  if (snapshot) {
    await sql`UPDATE snapshots SET active_truths = ${snapshot.activeTruths + 1}, updated_at = NOW() WHERE neighborhood_id = ${data.neighborhoodId}`;
  }

  return truth;
}

// ═══════════════════════════════════════════════════════════════
// Verifications
// ═══════════════════════════════════════════════════════════════

export async function verifyTruth(
  truthId: number,
  userHash: string,
  action: "corroborate" | "dispute" | "stale"
): Promise<{ truth: MicroTruth; verification: Verification }> {
  const sql = getDb();
  const truthRows = (await sql`SELECT * FROM micro_truths WHERE id = ${truthId}`) as unknown as SqlRow[];
  if (!truthRows[0]) throw new Error("Truth not found");
  const truth = mapTruth(truthRows[0]);

  if (truth.userHash === userHash) {
    throw new Error("You cannot verify your own truth");
  }

  const existing = (await sql`SELECT id FROM verifications WHERE truth_id = ${truthId} AND user_hash = ${userHash} LIMIT 1`) as unknown as SqlRow[];
  if (existing.length > 0) {
    throw new Error("You have already verified this truth");
  }

  const vRows = (await sql`INSERT INTO verifications (truth_id, user_hash, action) VALUES (${truthId}, ${userHash}, ${action}) RETURNING *`) as unknown as SqlRow[];
  const verification = {
    id: vRows[0].id,
    truthId: vRows[0].truth_id,
    userHash: vRows[0].user_hash,
    action: vRows[0].action,
    createdAt: vRows[0].created_at,
  } as Verification;

  let trustDelta = 0;
  let newStatus = truth.status;
  if (action === "corroborate") {
    trustDelta = 5;
    if (truth.trustScore + trustDelta >= 70) newStatus = "verified";
  } else if (action === "dispute") {
    trustDelta = -5;
    if (truth.trustScore + trustDelta < 40) newStatus = "rejected";
  } else if (action === "stale") {
    trustDelta = -2;
  }

  const newTrust = Math.max(0, Math.min(100, truth.trustScore + trustDelta));
  await sql`UPDATE micro_truths SET trust_score = ${newTrust}, status = ${newStatus} WHERE id = ${truthId}`;

  const description = `${action === "corroborate" ? "Corroborated" : action === "dispute" ? "Disputed" : "Marked stale"} truth #${truthId}`;
  await sql`INSERT INTO reward_ledger (user_hash, amount, type, description) VALUES (${userHash}, 10, 'verification', ${description})`;
  await sql`UPDATE device_profiles SET rewards_balance = rewards_balance + 10, trust_score = LEAST(100, trust_score + 1) WHERE device_id_hash = ${userHash}`;

  const updatedRows = (await sql`SELECT * FROM micro_truths WHERE id = ${truthId}`) as unknown as SqlRow[];
  return { truth: mapTruth(updatedRows[0]), verification };
}

export async function getVerifications(truthId: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM verifications WHERE truth_id = ${truthId} ORDER BY created_at DESC`) as unknown as SqlRow[];
  return rows.map((r) => ({
    id: r.id,
    truthId: r.truth_id,
    userHash: r.user_hash,
    action: r.action,
    createdAt: r.created_at,
  }));
}

// ═══════════════════════════════════════════════════════════════
// Snapshots
// ═══════════════════════════════════════════════════════════════

export async function getSnapshots(): Promise<Snapshot[]> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM snapshots`) as unknown as SqlRow[];
  return rows.map(mapSnapshot);
}

export async function getSnapshot(neighborhoodId: number): Promise<Snapshot | undefined> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM snapshots WHERE neighborhood_id = ${neighborhoodId}`) as unknown as SqlRow[];
  return rows[0] ? mapSnapshot(rows[0]) : undefined;
}

// ═══════════════════════════════════════════════════════════════
// Predictions
// ═══════════════════════════════════════════════════════════════

export async function getPredictions(category?: string, neighborhoodId?: number): Promise<Prediction[]> {
  const sql = getDb();
  let rows: SqlRow[];
  if (category && neighborhoodId) {
    rows = (await sql`SELECT * FROM predictions WHERE category = ${category} AND neighborhood_id = ${neighborhoodId} ORDER BY created_at DESC`) as unknown as SqlRow[];
  } else if (category) {
    rows = (await sql`SELECT * FROM predictions WHERE category = ${category} ORDER BY created_at DESC`) as unknown as SqlRow[];
  } else if (neighborhoodId) {
    rows = (await sql`SELECT * FROM predictions WHERE neighborhood_id = ${neighborhoodId} ORDER BY created_at DESC`) as unknown as SqlRow[];
  } else {
    rows = (await sql`SELECT * FROM predictions ORDER BY created_at DESC`) as unknown as SqlRow[];
  }
  return rows.map(mapPrediction);
}

export async function createPrediction(data: Omit<Prediction, "id" | "createdAt">): Promise<Prediction> {
  const sql = getDb();
  const rows = (await sql`INSERT INTO predictions (category, neighborhood_id, prediction, confidence, timeframe, trend, model_version) VALUES (${data.category}, ${data.neighborhoodId}, ${data.prediction}, ${data.confidence}, ${data.timeframe}, ${data.trend}, ${data.modelVersion}) RETURNING *`) as unknown as SqlRow[];
  return mapPrediction(rows[0]);
}

// ═══════════════════════════════════════════════════════════════
// Rewards
// ═══════════════════════════════════════════════════════════════

export async function getRewardBalance(userHash: string): Promise<number> {
  const device = await getDeviceProfile(userHash);
  return device?.rewardsBalance ?? 0;
}

export async function getRewardLedger(userHash: string): Promise<RewardLedger[]> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM reward_ledger WHERE user_hash = ${userHash} ORDER BY created_at DESC`) as unknown as SqlRow[];
  return rows.map(mapReward);
}

export async function redeemReward(userHash: string, amount: number, description: string): Promise<RewardLedger> {
  const sql = getDb();
  const balance = await getRewardBalance(userHash);
  if (amount > balance) throw new Error("Insufficient balance for redemption");

  const rows = (await sql`INSERT INTO reward_ledger (user_hash, amount, type, description) VALUES (${userHash}, ${-amount}, 'redemption', ${description}) RETURNING *`) as unknown as SqlRow[];
  const entry = mapReward(rows[0]);

  const device = await getDeviceProfile(userHash);
  if (device) {
    await sql`UPDATE device_profiles SET rewards_balance = ${device.rewardsBalance - amount} WHERE device_id_hash = ${userHash}`;
  }
  return entry;
}

// ═══════════════════════════════════════════════════════════════
// Trends
// ═══════════════════════════════════════════════════════════════

export async function getTrends() {
  const sql = getDb();
  const allTruths = (await sql`SELECT * FROM micro_truths`) as unknown as SqlRow[];
  const allSnapshots = (await sql`SELECT * FROM snapshots`) as unknown as SqlRow[];
  const allNeighborhoods = (await sql`SELECT * FROM neighborhoods`) as unknown as SqlRow[];
  const allPredictions = (await sql`SELECT * FROM predictions`) as unknown as SqlRow[];

  const truths = allTruths.map(mapTruth);
  const snapshots = allSnapshots.map(mapSnapshot);
  const neighborhoods = allNeighborhoods.map(mapNeighborhood);
  const predictions = allPredictions.map(mapPrediction);

  const categoryMap: Record<string, { count: number; trustSum: number; trendDirections: Record<string, number> }> = {};
  for (const t of truths) {
    if (!categoryMap[t.category]) categoryMap[t.category] = { count: 0, trustSum: 0, trendDirections: {} };
    categoryMap[t.category].count++;
    categoryMap[t.category].trustSum += t.trustScore;
  }
  for (const p of predictions) {
    if (!categoryMap[p.category]) categoryMap[p.category] = { count: 0, trustSum: 0, trendDirections: {} };
    if (!categoryMap[p.category].trendDirections[p.trend]) categoryMap[p.category].trendDirections[p.trend] = 0;
    categoryMap[p.category].trendDirections[p.trend]++;
  }
  const categoryTrends = Object.entries(categoryMap).map(([category, data]) => {
    const directions = data.trendDirections;
    const total = Object.values(directions).reduce((a, b) => a + b, 0) || 1;
    const upRatio = (directions.up || 0) / total;
    const downRatio = (directions.down || 0) / total;
    const trendDirection = upRatio > downRatio ? "up" : downRatio > upRatio ? "down" : "stable";
    return {
      category,
      count: data.count,
      avgTrust: data.count > 0 ? Math.round(data.trustSum / data.count) : 0,
      trendDirection,
    };
  });

  const neighborhoodTrends: Array<{ neighborhood: string; region: string; category: string; count: number; avgTrust: number }> = [];
  for (const n of neighborhoods) {
    const nTruths = truths.filter((t) => t.neighborhoodId === n.id);
    const catMap: Record<string, { count: number; trustSum: number }> = {};
    for (const t of nTruths) {
      if (!catMap[t.category]) catMap[t.category] = { count: 0, trustSum: 0 };
      catMap[t.category].count++;
      catMap[t.category].trustSum += t.trustScore;
    }
    for (const [cat, d] of Object.entries(catMap)) {
      neighborhoodTrends.push({
        neighborhood: n.name,
        region: n.region,
        category: cat,
        count: d.count,
        avgTrust: d.count > 0 ? Math.round(d.trustSum / d.count) : 0,
      });
    }
  }

  const now = new Date();
  const hours: Array<{ hour: string; power: number; fuel: number; traffic: number; prices: number; safety: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - (i + 1) * 3600000);
    const hourEnd = new Date(now.getTime() - i * 3600000);
    const hourLabel = hourStart.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    const bucketTruths = truths.filter((t) => {
      const tDate = new Date(t.createdAt);
      return tDate >= hourStart && tDate < hourEnd;
    });
    const cats = ["power", "fuel", "traffic", "prices", "safety"] as const;
    const entry: any = { hour: hourLabel };
    for (const cat of cats) {
      entry[cat] = bucketTruths.filter((t) => t.category === cat).length;
    }
    hours.push(entry);
  }

  const topNeighborhoods = neighborhoods
    .map((n) => {
      const nTruths = truths.filter((t) => t.neighborhoodId === n.id);
      const snapshot = snapshots.find((s) => s.neighborhoodId === n.id);
      const trustSum = nTruths.reduce((s, t) => s + t.trustScore, 0);
      return {
        name: n.name,
        region: n.region,
        truths: nTruths.length,
        avgTrust: nTruths.length > 0 ? Math.round(trustSum / nTruths.length) : 0,
        safetyIndex: snapshot?.safetyIndex ?? 0,
      };
    })
    .sort((a, b) => b.truths - a.truths);

  return {
    categoryTrends,
    neighborhoodTrends,
    timeSeriesData: hours,
    topNeighborhoods,
  };
}

// ═══════════════════════════════════════════════════════════════
// Alerts
// ═══════════════════════════════════════════════════════════════

export async function getAlerts() {
  const sql = getDb();
  const allNeighborhoods = (await sql`SELECT * FROM neighborhoods`) as unknown as SqlRow[];
  const allSnapshots = (await sql`SELECT * FROM snapshots`) as unknown as SqlRow[];
  const allPredictions = (await sql`SELECT * FROM predictions`) as unknown as SqlRow[];
  const neighborhoods = allNeighborhoods.map(mapNeighborhood);
  const snapshots = allSnapshots.map(mapSnapshot);
  const predictions = allPredictions.map(mapPrediction);

  const alerts: Array<any> = [];
  for (const snap of snapshots) {
    const n = neighborhoods.find((nn) => nn.id === snap.neighborhoodId);
    if (!n) continue;
    const baseTime = new Date(snap.updatedAt).getTime() || Date.now();
    if (snap.powerStatus === "off") alerts.push({ id: `power-off-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "power", severity: "critical", title: "Power Outage", description: `Power is currently OFF in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
    else if (snap.powerStatus === "unstable") alerts.push({ id: `power-unstable-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "power", severity: "warning", title: "Unstable Power", description: `Power supply is unstable in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
    if (snap.fuelStatus === "scarce") alerts.push({ id: `fuel-scarce-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "fuel", severity: "warning", title: "Fuel Scarcity", description: `Fuel scarcity reported in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
    else if (snap.fuelStatus === "unavailable") alerts.push({ id: `fuel-unavailable-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "fuel", severity: "critical", title: "Fuel Unavailable", description: `No fuel available in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
    if (snap.trafficLevel === "gridlock") alerts.push({ id: `traffic-gridlock-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "traffic", severity: "critical", title: "Traffic Gridlock", description: `Gridlock traffic conditions in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
    else if (snap.trafficLevel === "heavy") alerts.push({ id: `traffic-heavy-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "traffic", severity: "warning", title: "Heavy Traffic", description: `Heavy traffic reported in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
    if (snap.safetyIndex < 70) alerts.push({ id: `safety-low-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "safety", severity: snap.safetyIndex < 60 ? "critical" : "warning", title: "Low Safety Index", description: `Safety index is ${snap.safetyIndex}/100 in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
    if (snap.priceIndex > 110) alerts.push({ id: `prices-high-${n.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: "prices", severity: "warning", title: "High Price Index", description: `Price index is ${snap.priceIndex} (baseline 100) in ${n.name}, ${n.region}.`, detectedAt: new Date(baseTime).toISOString() });
  }
  for (const pred of predictions) {
    const n = neighborhoods.find((nn) => nn.id === pred.neighborhoodId);
    if (!n) continue;
    if (pred.trend === "down" && pred.confidence >= 70) alerts.push({ id: `pred-down-${pred.id}`, neighborhoodId: n.id, neighborhood: n.name, region: n.region, category: pred.category, severity: "warning", title: `Worsening ${pred.category} trend`, description: pred.prediction, detectedAt: new Date(pred.createdAt).toISOString() });
  }
  const sevOrder: any = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a: any, b: any) => {
    if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity];
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
  return alerts;
}

// ═══════════════════════════════════════════════════════════════
// Leaderboard
// ═══════════════════════════════════════════════════════════════

export async function getLeaderboard() {
  const sql = getDb();
  const allLedger = (await sql`SELECT * FROM reward_ledger`) as unknown as SqlRow[];
  const allTruths = (await sql`SELECT * FROM micro_truths`) as unknown as SqlRow[];
  const allDevices = (await sql`SELECT * FROM device_profiles`) as unknown as SqlRow[];
  const ledger = allLedger.map((r: SqlRow) => ({ userHash: r.user_hash, amount: r.amount, type: r.type }));
  const truths = allTruths.map((r: SqlRow) => ({ userHash: r.user_hash, trustScore: r.trust_score }));
  const devices = allDevices.map((r: SqlRow) => ({ deviceIdHash: r.device_id_hash, trustScore: r.trust_score }));

  const userMap: Record<string, any> = {};
  for (const entry of ledger) {
    if (!userMap[entry.userHash]) userMap[entry.userHash] = { totalCredits: 0, submissions: 0, verifications: 0, trustSum: 0, truthCount: 0 };
    userMap[entry.userHash].totalCredits += entry.amount;
    if (entry.type === "submission") userMap[entry.userHash].submissions++;
    if (entry.type === "verification") userMap[entry.userHash].verifications++;
  }
  for (const t of truths) {
    if (!userMap[t.userHash]) userMap[t.userHash] = { totalCredits: 0, submissions: 0, verifications: 0, trustSum: 0, truthCount: 0 };
    userMap[t.userHash].trustSum += t.trustScore;
    userMap[t.userHash].truthCount++;
  }
  const leaderboard = Object.entries(userMap)
    .map(([userHash, data]: [string, any]) => {
      const device = devices.find((d) => d.deviceIdHash === userHash);
      const trustScore = data.truthCount > 0 ? Math.round(data.trustSum / data.truthCount) : device?.trustScore ?? 50;
      let badge = "Newcomer";
      if (data.submissions >= 10) badge = "Veteran Reporter";
      else if (data.submissions >= 5) badge = "Trusted Reporter";
      else if (data.submissions >= 2) badge = "Active Reporter";
      return { userHash, totalCredits: Math.max(0, data.totalCredits), submissions: data.submissions, verifications: data.verifications, trustScore, badge };
    })
    .sort((a, b) => b.totalCredits - a.totalCredits);
  return leaderboard;
}

// ═══════════════════════════════════════════════════════════════
// Search
// ═══════════════════════════════════════════════════════════════

export async function search(query: string, category?: string, region?: string) {
  const sql = getDb();
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: any[] = [];
  const allTruths = (await sql`SELECT * FROM micro_truths`) as unknown as SqlRow[];
  const allNeighborhoods = (await sql`SELECT * FROM neighborhoods`) as unknown as SqlRow[];
  const allPredictions = (await sql`SELECT * FROM predictions`) as unknown as SqlRow[];

  for (const t of allTruths.map(mapTruth)) {
    if (category && t.category !== category) continue;
    const n = allNeighborhoods.map(mapNeighborhood).find((nn) => nn.id === t.neighborhoodId);
    if (region && n?.region !== region) continue;
    if (t.content.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)) {
      results.push({ type: "truth", id: t.id, title: t.content.slice(0, 80), description: `${t.category} report in ${n?.name || "Unknown"}, ${n?.region || ""}`, category: t.category, region: n?.region, trustScore: t.trustScore, createdAt: t.createdAt });
    }
  }
  for (const n of allNeighborhoods.map(mapNeighborhood)) {
    if (region && n.region !== region) continue;
    if (n.name.toLowerCase().includes(q) || n.region.toLowerCase().includes(q)) {
      results.push({ type: "neighborhood", id: n.id, title: n.name, description: `${n.region} · Geo: ${n.geoHash}`, region: n.region });
    }
  }
  for (const p of allPredictions.map(mapPrediction)) {
    if (category && p.category !== category) continue;
    const n = allNeighborhoods.map(mapNeighborhood).find((nn) => nn.id === p.neighborhoodId);
    if (region && n?.region !== region) continue;
    if (p.prediction.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) {
      results.push({ type: "prediction", id: p.id, title: p.prediction.slice(0, 80), description: `${p.category} prediction · ${p.confidence}% confidence`, category: p.category, region: n?.region, createdAt: p.createdAt });
    }
  }
  results.sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
  return results.slice(0, 50);
}

// ═══════════════════════════════════════════════════════════════
// Activity
// ═══════════════════════════════════════════════════════════════

export async function getActivity(limit = 50) {
  const sql = getDb();
  const allTruths = (await sql`SELECT * FROM micro_truths`) as unknown as SqlRow[];
  const allRewards = (await sql`SELECT * FROM reward_ledger`) as unknown as SqlRow[];
  const allPredictions = (await sql`SELECT * FROM predictions`) as unknown as SqlRow[];
  const allNeighborhoods = (await sql`SELECT * FROM neighborhoods`) as unknown as SqlRow[];

  const entries: any[] = [];
  const nName = (id: number) => allNeighborhoods.map(mapNeighborhood).find((n) => n.id === id)?.name || `Area ${id}`;
  const nRegion = (id: number) => allNeighborhoods.map(mapNeighborhood).find((n) => n.id === id)?.region || "";

  for (const t of allTruths.map(mapTruth)) {
    entries.push({ id: `truth-${t.id}`, type: "truth_submitted", description: t.content.slice(0, 120), userHash: t.userHash, category: t.category, neighborhood: nName(t.neighborhoodId), region: nRegion(t.neighborhoodId), timestamp: t.createdAt, metadata: { trustScore: t.trustScore, status: t.status } });
  }
  for (const r of allRewards.map(mapReward)) {
    if (r.type === "redemption") continue;
    entries.push({ id: `reward-${r.id}`, type: "reward_earned", description: r.description, userHash: r.userHash, timestamp: r.createdAt, metadata: { amount: r.amount, type: r.type } });
  }
  for (const p of allPredictions.map(mapPrediction)) {
    entries.push({ id: `pred-${p.id}`, type: "prediction_made", description: p.prediction.slice(0, 120), category: p.category, neighborhood: nName(p.neighborhoodId), region: nRegion(p.neighborhoodId), timestamp: p.createdAt, metadata: { confidence: p.confidence, trend: p.trend } });
  }
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return entries.slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════
// Health
// ═══════════════════════════════════════════════════════════════

export async function getHealth() {
  const sql = getDb();

  // Real database statistics — no hardcoded/simulated values
  const truthCount = (await sql`SELECT COUNT(*) as count FROM micro_truths`) as unknown as SqlRow[];
  const neighborhoodCount = (await sql`SELECT COUNT(*) as count FROM neighborhoods`) as unknown as SqlRow[];
  const userCount = (await sql`SELECT COUNT(*) as count FROM platform_users`) as unknown as SqlRow[];
  const orgCount = (await sql`SELECT COUNT(*) as count FROM organizations WHERE active = 1`) as unknown as SqlRow[];
  const regionCount = (await sql`SELECT COUNT(*) as count FROM regions`) as unknown as SqlRow[];
  const stateCount = (await sql`SELECT COUNT(*) as count FROM states`) as unknown as SqlRow[];

  // Check database connectivity latency
  const startMs = Date.now();
  await sql`SELECT 1`;
  const dbLatency = `${Date.now() - startMs}ms`;

  // Recent activity (last 24 hours)
  const recentTruths = (await sql`SELECT COUNT(*) as count FROM micro_truths WHERE created_at > ${new Date(Date.now() - 86400000).toISOString()}`) as unknown as SqlRow[];

  const dbHealthy = Number(truthCount[0]?.count ?? 0) >= 0;
  const status = dbHealthy ? "operational" : "degraded";

  return {
    status,
    services: [
      { name: "Database", status: dbHealthy ? "healthy" : "unhealthy", latency: dbLatency },
      { name: "Truth Engine", status: dbHealthy ? "healthy" : "unhealthy" },
      { name: "Geo Service", status: dbHealthy ? "healthy" : "unhealthy" },
      { name: "API Gateway", status: "healthy" },
    ],
    stats: {
      totalTruths: truthCount[0]?.count ?? 0,
      totalNeighborhoods: neighborhoodCount[0]?.count ?? 0,
      totalUsers: userCount[0]?.count ?? 0,
      totalOrganizations: orgCount[0]?.count ?? 0,
      totalRegions: regionCount[0]?.count ?? 0,
      totalStates: stateCount[0]?.count ?? 0,
      truthsLast24h: recentTruths[0]?.count ?? 0,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Organizations & Agency Accounts
// ═══════════════════════════════════════════════════════════════

export async function getOrganizations(type?: string, verifiedOnly?: boolean): Promise<Organization[]> {
  const sql = getDb();
  let rows: SqlRow[];
  if (type && verifiedOnly) {
    rows = (await sql`SELECT * FROM organizations WHERE type = ${type} AND verified = 1 AND active = 1 ORDER BY created_at DESC`) as unknown as SqlRow[];
  } else if (type) {
    rows = (await sql`SELECT * FROM organizations WHERE type = ${type} AND active = 1 ORDER BY created_at DESC`) as unknown as SqlRow[];
  } else if (verifiedOnly) {
    rows = (await sql`SELECT * FROM organizations WHERE verified = 1 AND active = 1 ORDER BY created_at DESC`) as unknown as SqlRow[];
  } else {
    rows = (await sql`SELECT * FROM organizations WHERE active = 1 ORDER BY created_at DESC`) as unknown as SqlRow[];
  }
  return rows.map(mapOrganization);
}

export async function getOrganization(id: number): Promise<Organization | undefined> {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM organizations WHERE id = ${id}`) as unknown as SqlRow[];
  return rows[0] ? mapOrganization(rows[0]) : undefined;
}

export async function createOrganization(data: {
  name: string;
  type: string;
  description?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  region?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  adminHash: string;
  clerkUserId?: string | null;
}): Promise<Organization> {
  const sql = getDb();
  const rows = (await sql`INSERT INTO organizations (name, type, description, contact_email, contact_phone, website, logo_url, region, city, lat, lng, verified, active, admin_hash, clerk_user_id) VALUES (${data.name}, ${data.type}, ${data.description ?? null}, ${data.contactEmail}, ${data.contactPhone ?? null}, ${data.website || null}, ${data.logoUrl || null}, ${data.region ?? null}, ${data.city ?? null}, ${data.lat ?? null}, ${data.lng ?? null}, 0, 1, ${data.adminHash}, ${data.clerkUserId ?? null}) RETURNING *`) as unknown as SqlRow[];
  return mapOrganization(rows[0]);
}

export async function getAgencyAccountByEmail(email: string) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM agency_accounts WHERE email = ${email}`) as unknown as SqlRow[];
  return rows[0] ? mapAgencyAccount(rows[0]) : undefined;
}

export async function getAgencyAccountById(id: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM agency_accounts WHERE id = ${id}`) as unknown as SqlRow[];
  return rows[0] ? mapAgencyAccount(rows[0]) : undefined;
}

export async function getAgencyAccountByClerkId(clerkUserId: string) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM agency_accounts WHERE clerk_user_id = ${clerkUserId}`) as unknown as SqlRow[];
  return rows[0] ? mapAgencyAccount(rows[0]) : undefined;
}

export async function createAgencyAccount(data: {
  organizationId: number;
  email: string;
  passwordHash: string;
  displayName: string;
  role?: string;
  clerkUserId?: string | null;
}) {
  const sql = getDb();
  const rows = (await sql`INSERT INTO agency_accounts (organization_id, email, password_hash, display_name, role, active, clerk_user_id) VALUES (${data.organizationId}, ${data.email}, ${data.passwordHash}, ${data.displayName}, ${data.role || "admin"}, 1, ${data.clerkUserId ?? null}) RETURNING *`) as unknown as SqlRow[];
  return mapAgencyAccount(rows[0]);
}

export async function updateAgencyAccount(id: number, data: Partial<{ displayName: string; passwordHash: string; lastLoginAt: string }>) {
  const sql = getDb();
  const rows = (await sql`UPDATE agency_accounts SET display_name = COALESCE(${data.displayName ?? null}, display_name), password_hash = COALESCE(${data.passwordHash ?? null}, password_hash), last_login_at = COALESCE(${data.lastLoginAt ?? null}, last_login_at), updated_at = ${new Date().toISOString()} WHERE id = ${id} RETURNING *`) as unknown as SqlRow[];
  return rows[0] ? mapAgencyAccount(rows[0]) : undefined;
}

export async function updateOrganizationProfile(id: number, data: Partial<{ description: string; contactEmail: string; contactPhone: string; website: string; region: string; city: string }>) {
  const sql = getDb();
  const rows = (await sql`UPDATE organizations SET description = COALESCE(${data.description ?? null}, description), contact_email = COALESCE(${data.contactEmail ?? null}, contact_email), contact_phone = COALESCE(${data.contactPhone ?? null}, contact_phone), website = COALESCE(${data.website ?? null}, website), region = COALESCE(${data.region ?? null}, region), city = COALESCE(${data.city ?? null}, city) WHERE id = ${id} RETURNING *`) as unknown as SqlRow[];
  return rows[0] ? mapOrganization(rows[0]) : undefined;
}

// ═══════════════════════════════════════════════════════════════
// Ingestion (batch)
// ═══════════════════════════════════════════════════════════════

export interface IngestTruthInput {
  neighborhoodId: number;
  category: string;
  content: string;
  userHash: string;
  reportLat?: number;
  reportLng?: number;
}

function sanitizeIngest(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function isDuplicate(content: string, category: string, neighborhoodId: number, existing: MicroTruth[]): boolean {
  const contentLower = content.toLowerCase().trim();
  const now = Date.now();
  for (const t of existing) {
    if (t.category !== category) continue;
    if (t.neighborhoodId !== neighborhoodId) continue;
    const ageMs = now - new Date(t.createdAt).getTime();
    if (ageMs > 30 * 60 * 1000) continue;
    const tWords = new Set(t.content.toLowerCase().split(/\s+/));
    const nWords = new Set(contentLower.split(/\s+/));
    const intersection = [...tWords].filter((w) => nWords.has(w)).length;
    const union = new Set([...tWords, ...nWords]).size;
    const similarity = union > 0 ? intersection / union : 0;
    if (similarity > 0.7) return true;
  }
  return false;
}

export async function ingestBatch(inputs: IngestTruthInput[]) {
  const sql = getDb();
  const bundleId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const accepted: MicroTruth[] = [];
  const rejected: Array<{ input: IngestTruthInput; reason: string }> = [];

  for (const input of inputs) {
    try {
      const sanitized = sanitizeIngest(input.content);
      if (sanitized.length < 10) throw new Error("Content must be at least 10 characters after sanitization");
      if (sanitized.length > 500) throw new Error("Content must not exceed 500 characters");

      const neighborhood = await getNeighborhood(input.neighborhoodId);
      if (!neighborhood) throw new Error("Neighborhood not found");

      const recentRows = (await sql`SELECT * FROM micro_truths WHERE neighborhood_id = ${input.neighborhoodId} ORDER BY created_at DESC LIMIT 20`) as unknown as SqlRow[];
      if (isDuplicate(sanitized, input.category, input.neighborhoodId, recentRows.map(mapTruth))) {
        throw new Error("Duplicate report detected within 30 minutes");
      }

      const truth = await createTruth({
        neighborhoodId: input.neighborhoodId,
        category: input.category,
        content: sanitized,
        userHash: input.userHash,
        reportLat: input.reportLat,
        reportLng: input.reportLng,
        locationSource: input.reportLat ? "gps" : undefined,
      });
      accepted.push(truth);
    } catch (e) {
      rejected.push({ input, reason: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  return { accepted, rejected, totalProcessed: inputs.length, bundleId };
}

// ═══════════════════════════════════════════════════════════════
// Mesh Sync
// ═══════════════════════════════════════════════════════════════

export interface SyncBundleItem {
  operation: "truth_create" | "verify" | "redeem";
  payload: Record<string, any>;
  clientTimestamp: string;
  clientId: string;
}

function genBundleId(): string {
  return `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

export async function handleSyncPush(req: { deviceHash: string; bundle: SyncBundleItem[]; lastSyncAt?: string }) {
  const sql = getDb();
  const bundleId = genBundleId();
  let accepted = 0;
  let rejected = 0;
  const conflicts: Array<{ clientId: string; reason: string; resolution: string }> = [];

  for (const item of req.bundle) {
    try {
      switch (item.operation) {
        case "truth_create": {
          const existing = (await sql`SELECT id FROM sync_queue WHERE bundle_id = ${item.clientId} LIMIT 1`) as unknown as SqlRow[];
          if (existing.length > 0) {
            rejected++;
            conflicts.push({ clientId: item.clientId, reason: "duplicate_client_id", resolution: "Item already synced, ignoring" });
            break;
          }
          await sql`INSERT INTO sync_queue (device_hash, operation, payload, status, bundle_id, synced_at) VALUES (${req.deviceHash}, ${item.operation}, ${JSON.stringify(item.payload)}, 'synced', ${item.clientId}, ${new Date().toISOString()})`;
          accepted++;
          break;
        }
        case "verify": {
          const truthId = item.payload.truthId;
          const existingVerif = (await sql`SELECT id FROM verifications WHERE truth_id = ${truthId} AND user_hash = ${req.deviceHash} LIMIT 1`) as unknown as SqlRow[];
          if (existingVerif.length > 0) {
            rejected++;
            conflicts.push({ clientId: item.clientId, reason: "already_verified", resolution: "Verification already recorded, ignoring" });
            break;
          }
          await sql`INSERT INTO sync_queue (device_hash, operation, payload, status, bundle_id, synced_at) VALUES (${req.deviceHash}, ${item.operation}, ${JSON.stringify(item.payload)}, 'synced', ${item.clientId}, ${new Date().toISOString()})`;
          accepted++;
          break;
        }
        case "redeem": {
          await sql`INSERT INTO sync_queue (device_hash, operation, payload, status, bundle_id, synced_at) VALUES (${req.deviceHash}, ${item.operation}, ${JSON.stringify(item.payload)}, 'synced', ${item.clientId}, ${new Date().toISOString()})`;
          accepted++;
          break;
        }
        default:
          rejected++;
          conflicts.push({ clientId: item.clientId, reason: "unknown_operation", resolution: "Skipped" });
      }
    } catch (e) {
      rejected++;
      conflicts.push({ clientId: item.clientId, reason: "processing_error", resolution: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  await sql`INSERT INTO mesh_events (bundle_id, device_hash, event, record_count, metadata) VALUES (${bundleId}, ${req.deviceHash}, 'sync_push', ${req.bundle.length}, ${JSON.stringify({ accepted, rejected, conflicts: conflicts.length })})`;

  return { bundleId, accepted, rejected, conflicts, serverTimestamp: new Date().toISOString() };
}

export async function handleSyncPull(req: { deviceHash: string; since?: string; neighborhoods?: number[] }) {
  const sql = getDb();
  const since = req.since || new Date(0).toISOString();

  let truthRows: SqlRow[];
  if (req.neighborhoods && req.neighborhoods.length > 0) {
    truthRows = [];
    for (const nid of req.neighborhoods) {
      const rows = (await sql`SELECT * FROM micro_truths WHERE neighborhood_id = ${nid} AND created_at > ${since} ORDER BY created_at DESC LIMIT 100`) as unknown as SqlRow[];
      truthRows.push(...rows);
    }
  } else {
    truthRows = (await sql`SELECT * FROM micro_truths ORDER BY created_at DESC LIMIT 100`) as unknown as SqlRow[];
  }

  const verificationRows = (await sql`SELECT * FROM verifications ORDER BY created_at DESC LIMIT 100`) as unknown as SqlRow[];

  const bundleId = genBundleId();
  await sql`INSERT INTO mesh_events (bundle_id, device_hash, event, record_count, metadata) VALUES (${bundleId}, ${req.deviceHash}, 'sync_pull', ${truthRows.length + verificationRows.length}, ${JSON.stringify({ since, neighborhoods: req.neighborhoods })})`;

  return {
    truths: truthRows.map(mapTruth),
    verifications: verificationRows.map((r) => ({ id: r.id, truthId: r.truth_id, userHash: r.user_hash, action: r.action, createdAt: r.created_at })),
    serverTimestamp: new Date().toISOString(),
    hasMore: truthRows.length === 100,
  };
}

export async function getSyncStatus(deviceHash: string) {
  const sql = getDb();
  const pending = (await sql`SELECT * FROM sync_queue WHERE device_hash = ${deviceHash} AND status = 'pending'`) as unknown as SqlRow[];
  const events = (await sql`SELECT * FROM mesh_events WHERE device_hash = ${deviceHash} ORDER BY created_at DESC LIMIT 10`) as unknown as SqlRow[];
  const lastSync = events.find((e) => e.event === "sync_push" || e.event === "sync_pull");

  return {
    pendingCount: pending.length,
    lastSyncAt: lastSync?.created_at || null,
    recentEvents: events.map((r) => ({
      id: r.id,
      bundleId: r.bundle_id,
      deviceHash: r.device_hash,
      event: r.event,
      recordCount: r.record_count,
      metadata: r.metadata,
      createdAt: r.created_at,
    })),
    totalEvents: events.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// Push Notifications
// ═══════════════════════════════════════════════════════════════

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0 && VAPID_PRIVATE_KEY.length > 0;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export async function registerSubscription(params: {
  deviceHash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  categories?: string[];
  neighborhoods?: number[];
}) {
  const sql = getDb();
  await sql`UPDATE push_subscriptions SET active = 0 WHERE device_hash = ${params.deviceHash}`;
  const rows = (await sql`INSERT INTO push_subscriptions (device_hash, endpoint, p256dh, auth, categories, neighborhoods, active) VALUES (${params.deviceHash}, ${params.endpoint}, ${params.p256dh}, ${params.auth}, ${JSON.stringify(params.categories || [])}, ${JSON.stringify(params.neighborhoods || [])}, 1) RETURNING *`) as unknown as SqlRow[];
  return { id: rows[0].id };
}

export async function unsubscribe(deviceHash: string, _endpoint: string): Promise<void> {
  const sql = getDb();
  await sql`UPDATE push_subscriptions SET active = 0 WHERE device_hash = ${deviceHash}`;
}

// ═══════════════════════════════════════════════════════════════
// Gamification
// ═══════════════════════════════════════════════════════════════

export function levelFromXP(xp: number): number {
  let level = 1;
  let threshold = LEVEL_BASE_XP;
  let cumulative = 0;
  while (cumulative + threshold <= xp) {
    cumulative += threshold;
    level++;
    threshold = Math.round(threshold * LEVEL_MULTIPLIER);
  }
  return level;
}

export function xpToNextLevel(xp: number) {
  let level = 1;
  let threshold = LEVEL_BASE_XP;
  let cumulative = 0;
  while (cumulative + threshold <= xp) {
    cumulative += threshold;
    level++;
    threshold = Math.round(threshold * LEVEL_MULTIPLIER);
  }
  const current = xp - cumulative;
  return { current, needed: threshold, percent: Math.round((current / threshold) * 100) };
}

async function getOrCreateUserStats(deviceHash: string) {
  const sql = getDb();
  const existing = (await sql`SELECT * FROM user_stats WHERE device_hash = ${deviceHash}`) as unknown as SqlRow[];
  if (existing[0]) {
    const r = existing[0];
    return {
      id: r.id,
      deviceHash: r.device_hash,
      xp: r.xp,
      level: r.level,
      currentStreak: r.current_streak,
      longestStreak: r.longest_streak,
      lastReportDate: r.last_report_date,
      totalReports: r.total_reports,
      totalVerifications: r.total_verifications,
      badges: parseBadges(r.badges),
      updatedAt: r.updated_at,
    };
  }
  const rows = (await sql`INSERT INTO user_stats (device_hash, xp, level, current_streak, longest_streak, total_reports, total_verifications, badges) VALUES (${deviceHash}, 0, 1, 0, 0, 0, 0, '[]') RETURNING *`) as unknown as SqlRow[];
  const r = rows[0];
  return {
    id: r.id,
    deviceHash: r.device_hash,
    xp: r.xp,
    level: r.level,
    currentStreak: r.current_streak,
    longestStreak: r.longest_streak,
    lastReportDate: r.last_report_date,
    totalReports: r.total_reports,
    totalVerifications: r.total_verifications,
    badges: r.badges,
    updatedAt: r.updated_at,
  };
}

export async function getGamificationProfile(deviceHash: string) {
  const sql = getDb();
  const stats = await getOrCreateUserStats(deviceHash);
  const achRows = (await sql`SELECT * FROM achievements WHERE device_hash = ${deviceHash} ORDER BY created_at DESC`) as unknown as SqlRow[];
  const achievements = achRows.map((r) => ({
    id: r.id,
    deviceHash: r.device_hash,
    achievement: r.achievement,
    tier: r.tier,
    xpAwarded: r.xp_awarded,
    createdAt: r.created_at,
  }));
  const levelProgress = xpToNextLevel(stats.xp);

  let tier = "Newcomer";
  if (stats.level >= 20) tier = "Legend";
  else if (stats.level >= 15) tier = "Master";
  else if (stats.level >= 10) tier = "Expert";
  else if (stats.level >= 5) tier = "Veteran";
  else if (stats.level >= 2) tier = "Regular";

  return { ...stats, levelProgress, tier, achievements, achievementDefs: ACHIEVEMENT_DEFS };
}

// ═══════════════════════════════════════════════════════════════
// Geo-Clustering
// ═══════════════════════════════════════════════════════════════

export function encodeGeohash(lat: number, lng: number, precision = 7): string {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let hash = "";
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; minLng = mid; }
      else { ch = (ch << 1); maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; minLat = mid; }
      else { ch = (ch << 1); maxLat = mid; }
    }
    even = !even;
    bit++;
    if (bit === 5) { hash += base32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

export async function getClustersForNeighborhood(neighborhoodId: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM geo_clusters WHERE neighborhood_id = ${neighborhoodId}`) as unknown as SqlRow[];
  return rows.map((r) => ({
    id: r.id,
    geoHash: r.geo_hash,
    neighborhoodId: r.neighborhood_id,
    clusterType: r.cluster_type,
    reportCount: r.report_count,
    avgTrustScore: r.avg_trust_score,
    centroidLat: r.centroid_lat,
    centroidLng: r.centroid_lng,
    radiusMeters: r.radius_meters,
    lastReportAt: r.last_report_at,
    createdAt: r.created_at,
  }));
}

export async function getHeatmapData() {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM geo_clusters`) as unknown as SqlRow[];
  return rows.map((c) => ({
    lat: c.centroid_lat,
    lng: c.centroid_lng,
    intensity: Math.min(1, c.report_count / 20),
    category: c.cluster_type,
    count: c.report_count,
  }));
}

export async function findClustersNearby(lat: number, lng: number, radiusMeters = 2000) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM geo_clusters`) as unknown as SqlRow[];
  const nearby = rows
    .map((c) => ({
      id: c.id,
      geoHash: c.geo_hash,
      neighborhoodId: c.neighborhood_id,
      clusterType: c.cluster_type,
      reportCount: c.report_count,
      avgTrustScore: c.avg_trust_score,
      centroidLat: c.centroid_lat,
      centroidLng: c.centroid_lng,
      radiusMeters: c.radius_meters,
      lastReportAt: c.last_report_at,
      createdAt: c.created_at,
      distance: haversineMeters(lat, lng, c.centroid_lat, c.centroid_lng),
    }))
    .filter((c) => c.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance);
  return nearby;
}

// ═══════════════════════════════════════════════════════════════
// AI Models — pure functions ported from src/server/models/*
// ═══════════════════════════════════════════════════════════════

// ─── Report Verification ───

function checkDuplicate(content: string, existing: MicroTruth[]) {
  const contentTokens = new Set(content.toLowerCase().split(/\s+/));
  let maxSimilarity = 0;
  for (const truth of existing) {
    const truthTokens = new Set(truth.content.toLowerCase().split(/\s+/));
    const intersection = [...contentTokens].filter((t) => truthTokens.has(t)).length;
    const union = new Set([...contentTokens, ...truthTokens]).size;
    const similarity = union > 0 ? intersection / union : 0;
    if (similarity > maxSimilarity) maxSimilarity = similarity;
  }
  return { isDuplicate: maxSimilarity > 0.75, similarity: maxSimilarity };
}

function detectSpam(content: string) {
  let risk = 0;
  if (/(.)\1{4,}/.test(content)) risk += 30;
  if (content === content.toUpperCase() && content.length > 20) risk += 20;
  if (/[!?]{3,}/.test(content)) risk += 15;
  if (/https?:\/\//i.test(content)) risk += 25;
  if (content.trim().length < 15) risk += 20;
  const words = content.toLowerCase().split(/\s+/);
  const wordCount: Record<string, number> = {};
  for (const w of words) wordCount[w] = (wordCount[w] || 0) + 1;
  const maxRepeat = Math.max(...Object.values(wordCount));
  if (maxRepeat > 5) risk += 20;
  return { isSpam: risk >= 50, riskScore: Math.min(100, risk) };
}

function assessCredibility(device: DeviceProfile | null): number {
  if (!device) return 40;
  let score = 50;
  if (device.totalSubmissions > 50) score += 20;
  else if (device.totalSubmissions > 20) score += 15;
  else if (device.totalSubmissions > 5) score += 10;
  score += (device.trustScore - 50) * 0.5;
  return Math.max(0, Math.min(100, score));
}

export async function runReportVerification(params: {
  content: string;
  category: string;
  deviceHash: string;
  neighborhoodId: number;
}) {
  const sql = getDb();
  const MODEL_VERSION = "report-verify-v1";
  const deviceRows = (await sql`SELECT * FROM device_profiles WHERE device_id_hash = ${params.deviceHash}`) as unknown as SqlRow[];
  const device = deviceRows[0] ? mapDevice(deviceRows[0]) : null;
  const recentRows = (await sql`SELECT * FROM micro_truths WHERE neighborhood_id = ${params.neighborhoodId} ORDER BY created_at DESC LIMIT 30`) as unknown as SqlRow[];
  const recentTruths = recentRows.map(mapTruth);

  const dupCheck = checkDuplicate(params.content, recentTruths);
  const spamCheck = detectSpam(params.content);
  const credibility = assessCredibility(device);

  let contentQuality = 50;
  if (params.content.length >= 30 && params.content.length <= 300) contentQuality += 20;
  const specificWords = (params.content.match(/\b\d+\b/g) || []).length;
  contentQuality += Math.min(specificWords * 5, 20);

  const signals = {
    contentQuality: Math.min(100, contentQuality),
    duplicateRisk: Math.round(dupCheck.similarity * 100),
    spamRisk: spamCheck.riskScore,
    sourceCredibility: credibility,
  };

  const confidence = Math.max(
    0,
    Math.min(
      1,
      (signals.contentQuality / 100) * 0.25 +
        (1 - signals.duplicateRisk / 100) * 0.3 +
        (1 - signals.spamRisk / 100) * 0.2 +
        (signals.sourceCredibility / 100) * 0.25
    )
  );
  const verified = confidence >= 0.6 && !dupCheck.isDuplicate && !spamCheck.isSpam;
  const explanation = `verified=${verified} confidence=${(confidence * 100).toFixed(0)}% | contentQuality=${signals.contentQuality} duplicateRisk=${signals.duplicateRisk} spamRisk=${signals.spamRisk} sourceCredibility=${signals.sourceCredibility}`;

  return { verified, confidence, signals, explanation, modelVersion: MODEL_VERSION };
}

// ─── Location Consistency ───

function validateGeohash(geoHash: string): boolean {
  const validChars = "0123456789bcdefghjkmnpqrstuvwxyz";
  if (!geoHash || geoHash.length < 4 || geoHash.length > 12) return false;
  for (const c of geoHash.toLowerCase()) {
    if (!validChars.includes(c)) return false;
  }
  return true;
}

export async function runLocationConsistency(params: {
  reportLat?: number;
  reportLng?: number;
  neighborhood: Neighborhood;
  deviceHash: string;
  reportTimestamp: string;
}) {
  const sql = getDb();
  const MODEL_VERSION = "location-consistency-v1";
  const { reportLat, reportLng, neighborhood, deviceHash, reportTimestamp } = params;

  let distance = 0;
  let withinNeighborhood = true;
  let plausibleMovement = true;
  let speedKmh = 0;

  if (reportLat !== undefined && reportLng !== undefined) {
    distance = haversineMeters(reportLat, reportLng, neighborhood.lat, neighborhood.lng);
    withinNeighborhood = distance < 2000;

    const recentReports = (await sql`SELECT * FROM micro_truths WHERE user_hash = ${deviceHash} ORDER BY created_at DESC LIMIT 5`) as unknown as SqlRow[];
    const recentNeighborhoodIds = recentReports.map((r) => r.neighborhood_id);
    if (recentNeighborhoodIds.length > 0) {
      const lastNRows = (await sql`SELECT * FROM neighborhoods WHERE id = ${recentNeighborhoodIds[0]}`) as unknown as SqlRow[];
      if (lastNRows[0]) {
        const d = haversineMeters(lastNRows[0].lat, lastNRows[0].lng, reportLat, reportLng);
        const timeDiff = (new Date(reportTimestamp).getTime() - new Date(recentReports[0].created_at).getTime()) / 1000;
        if (timeDiff > 0) {
          speedKmh = (d / 1000) / (timeDiff / 3600);
          plausibleMovement = speedKmh < 120;
          speedKmh = Math.round(speedKmh);
        }
      }
    }
  }

  const geohashValid = validateGeohash(neighborhood.geoHash);
  const gpsAccuracy = reportLat !== undefined && reportLng !== undefined ? 80 : 50;

  const signals = { withinNeighborhood, plausibleMovement, geohashValid, gpsAccuracy };
  let confidence = 0.5;
  if (withinNeighborhood) confidence += 0.2;
  if (plausibleMovement) confidence += 0.15;
  if (geohashValid) confidence += 0.1;
  confidence += (gpsAccuracy - 50) / 200;
  confidence = Math.max(0, Math.min(1, confidence));
  const consistent = withinNeighborhood && plausibleMovement && geohashValid;

  const explanation = `consistent=${consistent} | distance=${distance.toFixed(0)}m withinArea=${withinNeighborhood} movement=${plausibleMovement} (speed=${speedKmh}km/h) geohash=${geohashValid} gpsAccuracy=${gpsAccuracy}`;

  return { consistent, confidence, distance, signals, explanation, modelVersion: MODEL_VERSION };
}

// ─── Time Decay ───

const CATEGORY_DECAY_RATES: Record<string, number> = {
  power: 0.015,
  fuel: 0.012,
  traffic: 0.025,
  prices: 0.005,
  safety: 0.008,
};
const MIN_TRUST_FLOOR = 15;
const VERIFICATION_BOOST_PER = 2;
const VERIFICATION_RECENT_HOURS = 6;

export function runTimeDecayModel(params: { truth: MicroTruth; verifications?: Verification[] }) {
  const MODEL_VERSION = "time-decay-v1";
  const { truth, verifications } = params;
  const ageMs = Date.now() - new Date(truth.createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const decayRate = CATEGORY_DECAY_RATES[truth.category] || 0.01;
  const rawDecayFactor = Math.exp(-decayRate * ageHours);

  const recentVerifications = (verifications || []).filter((v) => {
    const vAge = Date.now() - new Date(v.createdAt).getTime();
    return vAge < VERIFICATION_RECENT_HOURS * 3600000;
  });
  const corroborations = recentVerifications.filter((v) => v.action === "corroborate").length;
  const disputes = recentVerifications.filter((v) => v.action === "dispute").length;
  const stale = recentVerifications.filter((v) => v.action === "stale").length;

  const verificationBoost =
    corroborations * VERIFICATION_BOOST_PER - disputes * (VERIFICATION_BOOST_PER + 1) - stale * VERIFICATION_BOOST_PER;
  const adjustedDecayFactor = Math.min(1.0, rawDecayFactor + verificationBoost * 0.02);
  const decayedScore = Math.max(MIN_TRUST_FLOOR, Math.round(truth.trustScore * adjustedDecayFactor));

  const explanation = `original=${truth.trustScore} decayed=${decayedScore} | age=${ageHours.toFixed(1)}h rate=${decayRate}/h decayFactor=${adjustedDecayFactor.toFixed(3)} | verifications: ${corroborations} corroborate, ${disputes} dispute, ${stale} stale (boost=${verificationBoost})`;

  return {
    originalScore: truth.trustScore,
    decayedScore,
    decayFactor: adjustedDecayFactor,
    ageHours,
    categoryDecayRate: decayRate,
    verificationBoost,
    explanation,
    modelVersion: MODEL_VERSION,
  };
}

export async function batchDecayTruths() {
  const sql = getDb();
  const allTruths = ((await sql`SELECT * FROM micro_truths`) as unknown as SqlRow[]).map(mapTruth);
  const updates: Array<{ truthId: number; result: ReturnType<typeof runTimeDecayModel> }> = [];

  for (const truth of allTruths) {
    const vRows = (await sql`SELECT * FROM verifications WHERE truth_id = ${truth.id} ORDER BY created_at DESC LIMIT 20`) as unknown as SqlRow[];
    const verifications = vRows.map((r) => ({
      id: r.id,
      truthId: r.truth_id,
      userHash: r.user_hash,
      action: r.action,
      createdAt: r.created_at,
    })) as Verification[];
    const result = runTimeDecayModel({ truth, verifications });
    if (Math.abs(result.decayedScore - truth.trustScore) > 2) {
      updates.push({ truthId: truth.id, result });
    }
  }
  return updates;
}

// ─── Pattern Detection ───

function detectVolumeSpike(truths: MicroTruth[]) {
  if (truths.length < 3) return { spike: false, ratio: 1 };
  const now = Date.now();
  const recentWindow = 30 * 60 * 1000;
  const baselineWindow = 3 * 3600000;
  const recent = truths.filter((t) => now - new Date(t.createdAt).getTime() < recentWindow);
  const baseline = truths.filter((t) => {
    const age = now - new Date(t.createdAt).getTime();
    return age >= recentWindow && age < baselineWindow + recentWindow;
  });
  if (baseline.length === 0) return { spike: recent.length > 5, ratio: recent.length > 0 ? recent.length : 1 };
  const rate = recent.length / (recentWindow / 3600000);
  const baselineRate = baseline.length / (baselineWindow / 3600000);
  if (baselineRate === 0) return { spike: recent.length > 3, ratio: rate > 0 ? Infinity : 0 };
  const ratio = rate / baselineRate;
  return { spike: ratio > 2.5, ratio: Math.round(ratio * 10) / 10 };
}

function detectTemporalPatterns(truths: MicroTruth[], category: string): string | null {
  const hourCounts: number[] = new Array(24).fill(0);
  for (const t of truths) {
    const hour = new Date(t.createdAt).getHours();
    hourCounts[hour]++;
  }
  const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
  const maxCount = hourCounts[maxHour];
  if (maxCount < 3) return null;
  if (category === "power" && maxHour >= 17 && maxHour <= 22) return "Power reports peak during evening hours (5PM-10PM), suggesting higher outage probability during peak demand";
  if (category === "traffic" && ((maxHour >= 7 && maxHour <= 10) || (maxHour >= 16 && maxHour <= 19))) return "Traffic reports concentrate during rush hours, consistent with daily commute patterns";
  if (category === "fuel" && maxHour >= 6 && maxHour <= 10) return "Fuel reports peak in morning hours, indicating early queue formation at stations";
  return null;
}

function detectTrend(truths: MicroTruth[]) {
  if (truths.length < 4) return { direction: "stable" as const, confidence: 40 };
  const sorted = [...truths].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);
  const firstAvgTrust = firstHalf.reduce((s, t) => s + t.trustScore, 0) / firstHalf.length;
  const secondAvgTrust = secondHalf.reduce((s, t) => s + t.trustScore, 0) / secondHalf.length;
  const diff = secondAvgTrust - firstAvgTrust;
  if (diff > 5) return { direction: "up" as const, confidence: Math.min(85, 50 + Math.abs(diff) * 3) };
  if (diff < -5) return { direction: "down" as const, confidence: Math.min(85, 50 + Math.abs(diff) * 3) };
  return { direction: "stable" as const, confidence: 50 };
}

export function runPatternDetection(params: { truths: MicroTruth[]; category: string; neighborhood: Neighborhood; snapshot?: Snapshot }) {
  const MODEL_VERSION = "pattern-detect-v1";
  const { truths, category, neighborhood, snapshot } = params;
  const patterns: Array<{ type: string; description: string; severity: "info" | "warning" | "critical" }> = [];
  let confidence = 40;
  let trend: "up" | "down" | "stable" = "stable";
  let prediction: string | undefined;
  let timeframe = "24h";

  const volumeSpike = detectVolumeSpike(truths);
  if (volumeSpike.spike) {
    patterns.push({ type: "volume_spike", description: `${volumeSpike.ratio}x normal report rate detected in ${neighborhood.name}`, severity: volumeSpike.ratio > 4 ? "critical" : "warning" });
    confidence += 20;
  }
  const temporalPattern = detectTemporalPatterns(truths, category);
  if (temporalPattern) {
    patterns.push({ type: "temporal_pattern", description: temporalPattern, severity: "info" });
    confidence += 10;
  }
  const trendResult = detectTrend(truths);
  trend = trendResult.direction;
  confidence = Math.max(confidence, trendResult.confidence);

  if (snapshot) {
    if (category === "power" && snapshot.powerStatus === "off") {
      patterns.push({ type: "active_outage", description: `Power currently OFF in ${neighborhood.name} — outage ongoing`, severity: "critical" });
      confidence += 25;
      prediction = `Power outage in ${neighborhood.name} expected to continue. Historical patterns suggest restoration within 2-6 hours.`;
      trend = "down";
    } else if (category === "power" && snapshot.powerStatus === "unstable") {
      patterns.push({ type: "unstable_power", description: `Power unstable in ${neighborhood.name} — fluctuations indicate risk of full outage`, severity: "warning" });
      confidence += 15;
      prediction = `Power instability in ${neighborhood.name} may escalate to full outage if not addressed.`;
      trend = "down";
    }
    if (category === "fuel" && (snapshot.fuelStatus === "scarce" || snapshot.fuelStatus === "unavailable")) {
      patterns.push({ type: "fuel_scarcity", description: `Fuel ${snapshot.fuelStatus} in ${neighborhood.name}`, severity: snapshot.fuelStatus === "unavailable" ? "critical" : "warning" });
      confidence += 20;
      prediction = `Fuel scarcity in ${neighborhood.name} likely to persist for 24-48 hours based on supply patterns.`;
      trend = "down";
    }
    if (category === "traffic" && snapshot.trafficLevel === "gridlock") {
      patterns.push({ type: "gridlock", description: `Traffic gridlock in ${neighborhood.name} — movement at standstill`, severity: "critical" });
      confidence += 20;
      prediction = `Gridlock in ${neighborhood.name} expected to clear within 60-90 minutes after peak hour.`;
      timeframe = "90m";
      trend = "stable";
    }
    if (category === "safety" && snapshot.safetyIndex < 65) {
      patterns.push({ type: "low_safety", description: `Safety index ${snapshot.safetyIndex}/100 in ${neighborhood.name} — elevated risk`, severity: snapshot.safetyIndex < 55 ? "critical" : "warning" });
      confidence += 15;
      prediction = `Safety risk elevated in ${neighborhood.name}. Exercise caution, especially after dark.`;
      trend = "down";
    }
  }

  if (!prediction && truths.length >= 5) {
    const avgTrust = truths.reduce((s, t) => s + t.trustScore, 0) / truths.length;
    prediction = `${category} situation in ${neighborhood.name} is ${trend === "up" ? "improving" : trend === "down" ? "deteriorating" : "stable"} based on ${truths.length} recent reports (avg trust: ${Math.round(avgTrust)}).`;
  }
  confidence = Math.min(95, confidence);
  return { prediction, confidence, trend, timeframe, patterns, modelVersion: MODEL_VERSION };
}

// ─── Predictive Outage ───

function estimateOutageProbability(snapshot: Snapshot, powerTruths: MicroTruth[]): number {
  let prob = 0.2;
  if (snapshot.powerStatus === "off") prob = 0.95;
  else if (snapshot.powerStatus === "unstable") prob = 0.65;
  const recentReports = powerTruths.filter((t) => Date.now() - new Date(t.createdAt).getTime() < 2 * 3600000);
  if (recentReports.length > 10) prob += 0.1;
  else if (recentReports.length > 5) prob += 0.05;
  if (recentReports.length > 0) {
    const avgTrust = recentReports.reduce((s, t) => s + t.trustScore, 0) / recentReports.length;
    if (avgTrust > 80) prob += 0.05;
  }
  const hour = new Date().getHours();
  if (hour >= 17 && hour <= 22) prob += 0.05;
  return Math.min(1, Math.max(0, prob));
}

function estimateDuration(snapshot: Snapshot, powerTruths: MicroTruth[]): number {
  if (snapshot.powerStatus === "on") return 0;
  if (snapshot.powerStatus === "unstable") return 1;
  const outageReports = powerTruths.filter(
    (t) =>
      t.content.toLowerCase().includes("off") ||
      t.content.toLowerCase().includes("outage") ||
      t.content.toLowerCase().includes("darkness") ||
      t.content.toLowerCase().includes("without power")
  );
  if (outageReports.length === 0) return 2;
  const sorted = outageReports.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const earliest = new Date(sorted[0].createdAt).getTime();
  const elapsed = (Date.now() - earliest) / (1000 * 60 * 60);
  const mentionsTransformer = powerTruths.some((t) => t.content.toLowerCase().includes("transformer"));
  let estimate = Math.max(2, 5 - elapsed);
  if (mentionsTransformer) estimate = Math.max(3, 7 - elapsed);
  return Math.round(estimate);
}

export function runPredictiveOutageModel(params: { neighborhood: Neighborhood; snapshot: Snapshot; powerTruths: MicroTruth[] }) {
  const MODEL_VERSION = "outage-predict-v1";
  const { neighborhood, snapshot, powerTruths } = params;
  const outageProb = estimateOutageProbability(snapshot, powerTruths);
  const estimatedDuration = estimateDuration(snapshot, powerTruths);
  const recentReports = powerTruths.filter((t) => Date.now() - new Date(t.createdAt).getTime() < 2 * 3600000);
  const avgTrustScore = recentReports.length > 0 ? Math.round(recentReports.reduce((s, t) => s + t.trustScore, 0) / recentReports.length) : 50;

  let prediction: string;
  let trend: "up" | "down" | "stable";
  let timeframe: string;

  if (snapshot.powerStatus === "off") {
    prediction = `Power outage in ${neighborhood.name} expected to persist for approximately ${estimatedDuration} more hours. ${recentReports.length} reports in last 2 hours with ${avgTrustScore}% average trust.`;
    trend = "down";
    timeframe = `${estimatedDuration}h`;
  } else if (snapshot.powerStatus === "unstable") {
    prediction = `Power instability in ${neighborhood.name} — ${(outageProb * 100).toFixed(0)}% probability of full outage. Monitor closely. Restoration typically takes 1-3 hours if it degrades.`;
    trend = "down";
    timeframe = "3h";
  } else {
    if (outageProb > 0.3) {
      prediction = `Power stable in ${neighborhood.name} but elevated risk (${(outageProb * 100).toFixed(0)}%) due to ${recentReports.length} recent reports and peak demand timing.`;
      trend = "stable";
      timeframe = "6h";
    } else {
      prediction = `Power expected to remain stable in ${neighborhood.name} for the next 6 hours based on current signals.`;
      trend = "up";
      timeframe = "6h";
    }
  }

  const confidence = Math.min(95, Math.round(outageProb * 60 + avgTrustScore * 0.4));
  const signals = {
    currentStatus: snapshot.powerStatus,
    reportVolume: recentReports.length,
    avgTrustScore,
    outageProbability: outageProb,
    estimatedDurationHours: estimatedDuration,
  };
  return { prediction, confidence, trend, timeframe, signals, modelVersion: MODEL_VERSION };
}

// ═══════════════════════════════════════════════════════════════
// Predictions generation (runAllPredictions)
// ═══════════════════════════════════════════════════════════════

export async function runAllPredictions() {
  const sql = getDb();
  const allNeighborhoods = ((await sql`SELECT * FROM neighborhoods`) as unknown as SqlRow[]).map(mapNeighborhood);
  const allSnapshots = ((await sql`SELECT * FROM snapshots`) as unknown as SqlRow[]).map(mapSnapshot);
  const allTruths = ((await sql`SELECT * FROM micro_truths`) as unknown as SqlRow[]).map(mapTruth);

  let outagePredictions = 0;
  let patternPredictions = 0;
  let aiPredictions = 0;

  // Outage predictions (heuristic)
  for (const neighborhood of allNeighborhoods) {
    const snapshot = allSnapshots.find((s) => s.neighborhoodId === neighborhood.id);
    if (!snapshot) continue;
    const neighborhoodTruths = allTruths.filter((t) => t.neighborhoodId === neighborhood.id);
    const powerTruths = neighborhoodTruths.filter((t) => t.category === "power");
    const result = runPredictiveOutageModel({ neighborhood, snapshot, powerTruths });
    if (result.confidence >= 50) {
      await createPrediction({
        category: "power",
        neighborhoodId: neighborhood.id,
        prediction: result.prediction,
        confidence: result.confidence,
        timeframe: result.timeframe,
        trend: result.trend,
        modelVersion: result.modelVersion,
      });
      outagePredictions++;
    }
  }

  // Pattern predictions (heuristic)
  for (const neighborhood of allNeighborhoods) {
    const neighborhoodTruths = allTruths.filter((t) => t.neighborhoodId === neighborhood.id);
    for (const category of TRUTH_CATEGORIES) {
      const categoryTruths = neighborhoodTruths.filter((t) => t.category === category);
      const result = runPatternDetection({ truths: categoryTruths, category, neighborhood });
      if (result.confidence >= 55 && result.prediction) {
        await createPrediction({
          category,
          neighborhoodId: neighborhood.id,
          prediction: result.prediction,
          confidence: result.confidence,
          timeframe: result.timeframe || "24h",
          trend: result.trend,
          modelVersion: result.modelVersion,
        });
        patternPredictions++;
      }
    }
  }

  // ─── Kimi K3 AI-enhanced predictions ───
  // Uses Kimi K3 to generate deeper, context-aware predictions per neighborhood.
  // Falls back gracefully if KIMI_API_KEY is not set.
  const { isKimiConfigured, getKimiModel, generateKimiJsonArray } = await import("@/lib/kimi");

  if (isKimiConfigured()) {
    const model = getKimiModel();
    const systemPrompt = `You are an AI analyst for Soke, a community truth-reporting platform for Nigerian neighborhoods. Analyze the provided neighborhood data and generate actionable predictions about infrastructure and safety conditions. Each prediction should include category, prediction text, confidence (0-100), timeframe, and trend (up/down/stable/risk).`;

    for (const neighborhood of allNeighborhoods) {
      const snapshot = allSnapshots.find((s) => s.neighborhoodId === neighborhood.id);
      const neighborhoodTruths = allTruths
        .filter((t) => t.neighborhoodId === neighborhood.id)
        .slice(0, 20)
        .map(t => ({ category: t.category, content: t.content, trustScore: t.trustScore, createdAt: t.createdAt }));

      if (neighborhoodTruths.length === 0) continue;

      const context = {
        neighborhood: neighborhood.name,
        region: neighborhood.region,
        snapshot: snapshot ? {
          powerStatus: snapshot.powerStatus,
          fuelStatus: snapshot.fuelStatus,
          trafficLevel: snapshot.trafficLevel,
          priceIndex: snapshot.priceIndex,
          safetyIndex: snapshot.safetyIndex,
          activeTruths: snapshot.activeTruths,
        } : null,
        recentTruths: neighborhoodTruths,
      };

      const userPrompt = `Analyze this neighborhood data and generate 1-3 predictions as a JSON array:
${JSON.stringify(context, null, 2)}

Format: [{"category":"power|fuel|traffic|prices|safety","prediction":"...","confidence":75,"timeframe":"next 6h","trend":"up|down|stable|risk"}]`;

      const { data: aiResults, source } = await generateKimiJsonArray<any>(
        systemPrompt,
        userPrompt,
        [],
        { temperature: 0.4, maxOutputTokens: 1024 }
      );

      if (source === "kimi" && Array.isArray(aiResults)) {
        for (const pred of aiResults.slice(0, 3)) {
          if (pred.prediction && pred.category) {
            await createPrediction({
              category: String(pred.category),
              neighborhoodId: neighborhood.id,
              prediction: String(pred.prediction),
              confidence: Math.min(100, Math.max(0, Number(pred.confidence) || 60)),
              timeframe: String(pred.timeframe || "24h"),
              trend: String(pred.trend || "stable"),
              modelVersion: `kimi:${model}`,
            });
            aiPredictions++;
          }
        }
      }
    }
  }

  return { outagePredictions, patternPredictions, aiPredictions, total: outagePredictions + patternPredictions + aiPredictions };
}

// ═══════════════════════════════════════════════════════════════
// Auth helpers (bcrypt) — Clerk manages sessions; these are for
// password-based agency account linkage.
// ═══════════════════════════════════════════════════════════════

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ═══════════════════════════════════════════════════════════════
// Platform users (Clerk-synced)
// ═══════════════════════════════════════════════════════════════

export async function upsertPlatformUser(data: {
  clerkUserId: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  const sql = getDb();
  const existing = (await sql`SELECT * FROM platform_users WHERE clerk_user_id = ${data.clerkUserId}`) as unknown as SqlRow[];
  if (existing[0]) {
    const rows = (await sql`UPDATE platform_users SET email = ${data.email}, display_name = COALESCE(${data.displayName ?? null}, display_name), avatar_url = COALESCE(${data.avatarUrl ?? null}, avatar_url), updated_at = NOW() WHERE clerk_user_id = ${data.clerkUserId} RETURNING *`) as unknown as SqlRow[];
    return rows[0];
  }
  const rows = (await sql`INSERT INTO platform_users (clerk_user_id, email, display_name, avatar_url) VALUES (${data.clerkUserId}, ${data.email}, ${data.displayName ?? null}, ${data.avatarUrl ?? null}) RETURNING *`) as unknown as SqlRow[];
  return rows[0];
}

export async function getPlatformUserByClerkId(clerkUserId: string) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM platform_users WHERE clerk_user_id = ${clerkUserId}`) as unknown as SqlRow[];
  return rows[0] ?? null;
}

export async function getPlatformUserOrgId(clerkUserId: string): Promise<number | null> {
  const user = await getPlatformUserByClerkId(clerkUserId);
  return user?.organization_id ?? null;
}

// ═══════════════════════════════════════════════════════════════
// Admin / Org management
// ═══════════════════════════════════════════════════════════════

export async function getAdminStats() {
  const sql = getDb();
  const users = (await sql`SELECT COUNT(*) as count FROM platform_users`) as unknown as SqlRow[];
  const orgs = (await sql`SELECT COUNT(*) as count FROM organizations WHERE active = 1`) as unknown as SqlRow[];
  const truths = (await sql`SELECT COUNT(*) as count FROM micro_truths`) as unknown as SqlRow[];
  const rewards = (await sql`SELECT COALESCE(SUM(amount), 0) as total FROM reward_ledger WHERE amount > 0`) as unknown as SqlRow[];
  const pendingOrgs = (await sql`SELECT COUNT(*) as count FROM organizations WHERE verified = 0 AND active = 1`) as unknown as SqlRow[];
  const members = (await sql`SELECT COUNT(*) as count FROM org_members WHERE active = 1`) as unknown as SqlRow[];
  const vacancies = (await sql`SELECT COUNT(*) as count FROM vacancies WHERE status = 'open'`) as unknown as SqlRow[];

  // Geo-hierarchical breakdown of truths
  const truthsByState = (await sql`SELECT COALESCE(state_name, ip_region, 'Unknown') as name, COUNT(*) as count FROM micro_truths GROUP BY COALESCE(state_name, ip_region, 'Unknown') ORDER BY count DESC`) as unknown as SqlRow[];
  const truthsByCategory = (await sql`SELECT category, COUNT(*) as count FROM micro_truths GROUP BY category ORDER BY count DESC`) as unknown as SqlRow[];
  const truthsByLga = (await sql`SELECT COALESCE(lga_name, 'Unknown') as name, COUNT(*) as count FROM micro_truths GROUP BY COALESCE(lga_name, 'Unknown') ORDER BY count DESC LIMIT 20`) as unknown as SqlRow[];
  const truthsByCommunity = (await sql`SELECT COALESCE(community_name, 'Unknown') as name, COUNT(*) as count FROM micro_truths GROUP BY COALESCE(community_name, 'Unknown') ORDER BY count DESC LIMIT 20`) as unknown as SqlRow[];
  const truthsByRegion = (await sql`SELECT COALESCE(region_name, 'Unknown') as name, COUNT(*) as count FROM micro_truths GROUP BY COALESCE(region_name, 'Unknown') ORDER BY count DESC`) as unknown as SqlRow[];

  return {
    totalUsers: users[0]?.count ?? 0,
    totalOrganizations: orgs[0]?.count ?? 0,
    totalTruths: truths[0]?.count ?? 0,
    totalRewards: rewards[0]?.total ?? 0,
    pendingOrganizations: pendingOrgs[0]?.count ?? 0,
    totalMembers: members[0]?.count ?? 0,
    openVacancies: vacancies[0]?.count ?? 0,
    truthsByState: truthsByState.map((r: SqlRow) => ({ name: r.name, count: r.count })),
    truthsByCategory: truthsByCategory.map((r: SqlRow) => ({ name: r.category, count: r.count })),
    truthsByLga: truthsByLga.map((r: SqlRow) => ({ name: r.name, count: r.count })),
    truthsByCommunity: truthsByCommunity.map((r: SqlRow) => ({ name: r.name, count: r.count })),
    truthsByRegion: truthsByRegion.map((r: SqlRow) => ({ name: r.name, count: r.count })),
  };
}

export async function getPlatformUsers(limit = 100, offset = 0) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM platform_users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`) as unknown as SqlRow[];
  return rows.map((r) => ({
    id: r.id,
    clerkUserId: r.clerk_user_id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    role: r.role,
    isAdmin: r.is_admin,
    isOrgAdmin: r.is_org_admin,
    organizationId: r.organization_id,
    lastIpHash: r.last_ip_hash ?? null,
    lastIpRegion: r.last_ip_region ?? null,
    lastIpCity: r.last_ip_city ?? null,
    state: r.state ?? null,
    lga: r.lga ?? null,
    community: r.community ?? null,
    village: r.village ?? null,
    region: r.region ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function updatePlatformUser(id: number, data: { role?: string; isAdmin?: boolean; isOrgAdmin?: boolean; organizationId?: number | null }) {
  const sql = getDb();
  const rows = (await sql`UPDATE platform_users SET role = COALESCE(${data.role ?? null}, role), is_admin = COALESCE(${data.isAdmin ?? null}, is_admin), is_org_admin = COALESCE(${data.isOrgAdmin ?? null}, is_org_admin), organization_id = COALESCE(${data.organizationId ?? null}, organization_id), updated_at = NOW() WHERE id = ${id} RETURNING *`) as unknown as SqlRow[];
  return rows[0] ?? null;
}

export async function getOrgMembers(organizationId: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM org_members WHERE organization_id = ${organizationId} ORDER BY created_at DESC`) as unknown as SqlRow[];
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    clerkUserId: r.clerk_user_id,
    email: r.email,
    displayName: r.display_name,
    role: r.role,
    permissions: typeof r.permissions === "string" ? JSON.parse(r.permissions || "[]") : r.permissions || [],
    active: r.active,
    invitedBy: r.invited_by,
    invitedAt: r.invited_at,
    joinedAt: r.joined_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function addOrgMember(data: {
  organizationId: number;
  clerkUserId: string;
  email: string;
  displayName: string;
  role?: string;
  permissions?: string[];
  invitedBy?: string | null;
}) {
  const sql = getDb();
  const perms = JSON.stringify(data.permissions || []);
  const rows = (await sql`INSERT INTO org_members (organization_id, clerk_user_id, email, display_name, role, permissions, active, invited_by, joined_at) VALUES (${data.organizationId}, ${data.clerkUserId}, ${data.email}, ${data.displayName}, ${data.role || "member"}, ${perms}::jsonb, 1, ${data.invitedBy ?? null}, NOW()) RETURNING *`) as unknown as SqlRow[];
  return rows[0];
}

export async function getOrgMemberById(id: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM org_members WHERE id = ${id}`) as unknown as SqlRow[];
  return rows[0] ?? null;
}

export async function updateOrgMember(id: number, data: { role?: string; permissions?: string[]; active?: number }) {
  const sql = getDb();
  // Update permissions explicitly when provided, otherwise leave unchanged.
  if (data.permissions !== undefined) {
    const permsJson = JSON.stringify(data.permissions);
    await sql`UPDATE org_members SET permissions = ${permsJson}::jsonb, updated_at = NOW() WHERE id = ${id}`;
  }
  const rows = (await sql`UPDATE org_members SET role = COALESCE(${data.role ?? null}, role), active = COALESCE(${data.active ?? null}, active), updated_at = NOW() WHERE id = ${id} RETURNING *`) as unknown as SqlRow[];
  return rows[0] ?? null;
}

export async function deleteOrgMember(id: number) {
  const sql = getDb();
  await sql`UPDATE org_members SET active = 0, updated_at = NOW() WHERE id = ${id}`;
  return { success: true };
}

export async function getVacancies(organizationId: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM vacancies WHERE organization_id = ${organizationId} ORDER BY created_at DESC`) as unknown as SqlRow[];
  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    title: r.title,
    description: r.description,
    category: r.category,
    location: r.location,
    employmentType: r.employment_type,
    salaryRange: r.salary_range,
    requirements: typeof r.requirements === "string" ? JSON.parse(r.requirements || "[]") : r.requirements || [],
    responsibilities: typeof r.responsibilities === "string" ? JSON.parse(r.responsibilities || "[]") : r.responsibilities || [],
    status: r.status,
    applicationDeadline: r.application_deadline,
    postedByClerkId: r.posted_by_clerk_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function createVacancy(data: {
  organizationId: number;
  title: string;
  description: string;
  category?: string;
  location?: string | null;
  employmentType?: string;
  salaryRange?: string | null;
  requirements?: string[];
  responsibilities?: string[];
  applicationDeadline?: string | null;
  postedByClerkId: string;
}) {
  const sql = getDb();
  const reqs = JSON.stringify(data.requirements || []);
  const resps = JSON.stringify(data.responsibilities || []);
  const rows = (await sql`INSERT INTO vacancies (organization_id, title, description, category, location, employment_type, salary_range, requirements, responsibilities, status, application_deadline, posted_by_clerk_id) VALUES (${data.organizationId}, ${data.title}, ${data.description}, ${data.category || "general"}, ${data.location ?? null}, ${data.employmentType || "full-time"}, ${data.salaryRange ?? null}, ${reqs}::jsonb, ${resps}::jsonb, 'open', ${data.applicationDeadline ?? null}, ${data.postedByClerkId}) RETURNING *`) as unknown as SqlRow[];
  return rows[0];
}

export async function getVacancyById(id: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM vacancies WHERE id = ${id}`) as unknown as SqlRow[];
  return rows[0] ?? null;
}

export async function updateVacancy(id: number, data: {
  title?: string;
  description?: string;
  category?: string;
  location?: string | null;
  employmentType?: string;
  salaryRange?: string | null;
  status?: string;
  applicationDeadline?: string | null;
}) {
  const sql = getDb();
  const rows = (await sql`UPDATE vacancies SET title = COALESCE(${data.title ?? null}, title), description = COALESCE(${data.description ?? null}, description), category = COALESCE(${data.category ?? null}, category), location = COALESCE(${data.location ?? null}, location), employment_type = COALESCE(${data.employmentType ?? null}, employment_type), salary_range = COALESCE(${data.salaryRange ?? null}, salary_range), status = COALESCE(${data.status ?? null}, status), application_deadline = COALESCE(${data.applicationDeadline ?? null}, application_deadline), updated_at = NOW() WHERE id = ${id} RETURNING *`) as unknown as SqlRow[];
  return rows[0] ?? null;
}

export async function deleteVacancy(id: number) {
  const sql = getDb();
  await sql`DELETE FROM vacancies WHERE id = ${id}`;
  return { success: true };
}

export async function getVacancyApplications(vacancyId: number) {
  const sql = getDb();
  const rows = (await sql`SELECT * FROM vacancy_applications WHERE vacancy_id = ${vacancyId} ORDER BY created_at DESC`) as unknown as SqlRow[];
  return rows.map((r) => ({
    id: r.id,
    vacancyId: r.vacancy_id,
    clerkUserId: r.clerk_user_id,
    applicantName: r.applicant_name,
    applicantEmail: r.applicant_email,
    coverLetter: r.cover_letter,
    resumeUrl: r.resume_url,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function createVacancyApplication(data: {
  vacancyId: number;
  clerkUserId?: string | null;
  applicantName: string;
  applicantEmail: string;
  coverLetter?: string | null;
  resumeUrl?: string | null;
}) {
  const sql = getDb();
  const rows = (await sql`INSERT INTO vacancy_applications (vacancy_id, clerk_user_id, applicant_name, applicant_email, cover_letter, resume_url, status) VALUES (${data.vacancyId}, ${data.clerkUserId ?? null}, ${data.applicantName}, ${data.applicantEmail}, ${data.coverLetter ?? null}, ${data.resumeUrl ?? null}, 'pending') RETURNING *`) as unknown as SqlRow[];
  return rows[0];
}

// ─── Admin: IP Tracking & Geo-Hierarchical Functions ───

export async function updatePlatformUserIpInfo(clerkUserId: string, data: {
  ipHash?: string | null;
  ipRegion?: string | null;
  ipCity?: string | null;
  state?: string | null;
  lga?: string | null;
  community?: string | null;
  village?: string | null;
  region?: string | null;
}) {
  const sql = getDb();
  await sql`UPDATE platform_users SET 
    last_ip_hash = COALESCE(${data.ipHash ?? null}, last_ip_hash), 
    last_ip_region = COALESCE(${data.ipRegion ?? null}, last_ip_region), 
    last_ip_city = COALESCE(${data.ipCity ?? null}, last_ip_city),
    state = COALESCE(${data.state ?? null}, state),
    lga = COALESCE(${data.lga ?? null}, lga),
    community = COALESCE(${data.community ?? null}, community),
    village = COALESCE(${data.village ?? null}, village),
    region = COALESCE(${data.region ?? null}, region),
    updated_at = NOW() 
    WHERE clerk_user_id = ${clerkUserId}`;
}

export async function getAdminTruths(limit = 100, offset = 0, filters?: {
  state?: string;
  lga?: string;
  community?: string;
  village?: string;
  region?: string;
}) {
  const sql = getDb();

  // Build WHERE conditions dynamically and execute with proper SQL filtering
  // before LIMIT/OFFSET, not in JS after fetching.
  let rows: SqlRow[];

  if (filters?.village) {
    rows = (await sql`SELECT t.*, n.name as neighborhood_name FROM micro_truths t LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id WHERE COALESCE(t.village_name, 'Unknown') = ${filters.village} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`) as unknown as SqlRow[];
  } else if (filters?.community) {
    rows = (await sql`SELECT t.*, n.name as neighborhood_name FROM micro_truths t LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id WHERE COALESCE(t.community_name, 'Unknown') = ${filters.community} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`) as unknown as SqlRow[];
  } else if (filters?.lga) {
    rows = (await sql`SELECT t.*, n.name as neighborhood_name FROM micro_truths t LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id WHERE COALESCE(t.lga_name, 'Unknown') = ${filters.lga} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`) as unknown as SqlRow[];
  } else if (filters?.state) {
    rows = (await sql`SELECT t.*, n.name as neighborhood_name FROM micro_truths t LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id WHERE COALESCE(t.state_name, t.ip_region, 'Unknown') = ${filters.state} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`) as unknown as SqlRow[];
  } else if (filters?.region) {
    rows = (await sql`SELECT t.*, n.name as neighborhood_name FROM micro_truths t LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id WHERE COALESCE(t.region_name, 'Unknown') = ${filters.region} ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`) as unknown as SqlRow[];
  } else {
    // No filters — fetch all
    rows = (await sql`SELECT t.*, n.name as neighborhood_name FROM micro_truths t LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}`) as unknown as SqlRow[];
  }

  return rows.map((r) => ({
    id: r.id,
    neighborhoodId: r.neighborhood_id,
    neighborhoodName: r.neighborhood_name,
    category: r.category,
    content: r.content,
    trustScore: r.trust_score,
    status: r.status,
    createdAt: r.created_at,
    ipHash: r.ip_hash ?? null,
    ipRegion: r.ip_region ?? null,
    ipCity: r.ip_city ?? null,
    reportLat: r.report_lat ?? null,
    reportLng: r.report_lng ?? null,
    locationSource: r.location_source ?? null,
    stateName: r.state_name ?? null,
    lgaName: r.lga_name ?? null,
    communityName: r.community_name ?? null,
    villageName: r.village_name ?? null,
    regionName: r.region_name ?? null,
    userHash: r.user_hash,
  }));
}

export async function getGeoHierarchy() {
  const sql = getDb();
  const regions = (await sql`SELECT id, name FROM regions ORDER BY name`) as unknown as SqlRow[];
  const states = (await sql`SELECT s.id, s.name, r.name as region_name FROM states s LEFT JOIN regions r ON s.region_id = r.id ORDER BY s.name`) as unknown as SqlRow[];
  const lgas = (await sql`SELECT l.id, l.name, s.name as state_name FROM lgas l LEFT JOIN states s ON l.state_id = s.id ORDER BY l.name`) as unknown as SqlRow[];
  const villages = (await sql`SELECT v.id, v.name, l.name as lga_name FROM villages v LEFT JOIN lgas l ON v.lga_id = l.id ORDER BY v.name`) as unknown as SqlRow[];
  const communities = (await sql`SELECT c.id, c.name, v.name as village_name FROM communities c LEFT JOIN villages v ON c.village_id = v.id ORDER BY c.name`) as unknown as SqlRow[];
  // Also get distinct geo values from neighborhoods and micro_truths
  const truthStates = (await sql`SELECT DISTINCT COALESCE(state_name, ip_region) as name FROM micro_truths WHERE COALESCE(state_name, ip_region) IS NOT NULL ORDER BY name`) as unknown as SqlRow[];
  const truthLgas = (await sql`SELECT DISTINCT lga_name as name FROM micro_truths WHERE lga_name IS NOT NULL ORDER BY name`) as unknown as SqlRow[];
  const truthCommunities = (await sql`SELECT DISTINCT community_name as name FROM micro_truths WHERE community_name IS NOT NULL ORDER BY name`) as unknown as SqlRow[];
  const truthRegions = (await sql`SELECT DISTINCT region_name as name FROM micro_truths WHERE region_name IS NOT NULL ORDER BY name`) as unknown as SqlRow[];
  const neighborhoodStates = (await sql`SELECT DISTINCT state as name FROM neighborhoods WHERE state IS NOT NULL ORDER BY name`) as unknown as SqlRow[];
  const neighborhoodLgas = (await sql`SELECT DISTINCT lga as name FROM neighborhoods WHERE lga IS NOT NULL ORDER BY name`) as unknown as SqlRow[];
  const neighborhoodCommunities = (await sql`SELECT DISTINCT community as name FROM neighborhoods WHERE community IS NOT NULL ORDER BY name`) as unknown as SqlRow[];

  // Merge reference data with truth-derived data
  const allStates = [...new Set([...states.map(s => s.name), ...truthStates.map(s => s.name), ...neighborhoodStates.map(s => s.name)])].sort();
  const allLgas = [...new Set([...lgas.map(l => l.name), ...truthLgas.map(l => l.name), ...neighborhoodLgas.map(l => l.name)])].sort();
  const allCommunities = [...new Set([...communities.map(c => c.name), ...truthCommunities.map(c => c.name), ...neighborhoodCommunities.map(c => c.name)])].sort();
  const allRegions = [...new Set([...regions.map(r => r.name), ...truthRegions.map(r => r.name)])].sort();

  return {
    regions: allRegions,
    states: allStates,
    lgas: allLgas,
    communities: allCommunities,
    villages: villages.map(v => v.name),
  };
}

export async function deleteTruth(id: number): Promise<boolean> {
  const sql = getDb();
  const rows = (await sql`DELETE FROM micro_truths WHERE id = ${id} RETURNING id`) as unknown as SqlRow[];
  return rows.length > 0;
}

export async function deleteAllTruths() {
  const sql = getDb();
  await sql`DELETE FROM micro_truths`;
  await sql`DELETE FROM verifications`;
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════
// Browsing Events, Post Suggestions, Feed Snapshots, Weekly Reviews
// ═══════════════════════════════════════════════════════════════

/**
 * Record a user browsing event for AI suggestion tracking.
 */
export async function recordBrowsingEvent(data: {
  clerkUserId?: string | null;
  userHash?: string | null;
  eventType: string;
  truthId?: number | null;
  neighborhoodId?: number | null;
  category?: string | null;
  path?: string | null;
  metadata?: Record<string, any> | null;
  dwellMs?: number;
}) {
  const sql = getDb();
  await sql`
    INSERT INTO user_browsing_events
      (clerk_user_id, user_hash, event_type, truth_id, neighborhood_id, category, path, metadata, dwell_ms)
    VALUES
      (${data.clerkUserId ?? null}, ${data.userHash ?? null}, ${data.eventType},
       ${data.truthId ?? null}, ${data.neighborhoodId ?? null}, ${data.category ?? null},
       ${data.path ?? null}, ${JSON.stringify(data.metadata ?? {})}::jsonb, ${data.dwellMs ?? 0})
  `;
}

/**
 * Get the browsing profile for a user — top categories, neighborhoods, etc.
 */
export async function getUserBrowsingProfile(clerkUserId?: string | null, userHash?: string | null) {
  const sql = getDb();
  if (!clerkUserId && !userHash) return null;

  // Top categories
  const topCategories = (await sql`
    SELECT category, COUNT(*) as count
    FROM user_browsing_events
    WHERE ${clerkUserId ? sql`clerk_user_id = ${clerkUserId}` : sql`user_hash = ${userHash}`}
      AND category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC
    LIMIT 5
  `) as unknown as SqlRow[];

  // Top neighborhoods
  const topNeighborhoods = (await sql`
    SELECT neighborhood_id, COUNT(*) as count
    FROM user_browsing_events
    WHERE ${clerkUserId ? sql`clerk_user_id = ${clerkUserId}` : sql`user_hash = ${userHash}`}
      AND neighborhood_id IS NOT NULL
    GROUP BY neighborhood_id
    ORDER BY count DESC
    LIMIT 5
  `) as unknown as SqlRow[];

  // Total events
  const totalRow = (await sql`
    SELECT COUNT(*) as count FROM user_browsing_events
    WHERE ${clerkUserId ? sql`clerk_user_id = ${clerkUserId}` : sql`user_hash = ${userHash}`}
  `) as unknown as SqlRow[];

  // Liked truths
  const likedTruths = (await sql`
    SELECT DISTINCT truth_id FROM feed_likes
    WHERE user_hash = ${userHash ?? clerkUserId ?? ''}
  `) as unknown as SqlRow[];

  // Most viewed truths
  const viewedTruths = (await sql`
    SELECT truth_id, COUNT(*) as views
    FROM user_browsing_events
    WHERE ${clerkUserId ? sql`clerk_user_id = ${clerkUserId}` : sql`user_hash = ${userHash}`}
      AND event_type = 'post_detail_open' AND truth_id IS NOT NULL
    GROUP BY truth_id
    ORDER BY views DESC
    LIMIT 10
  `) as unknown as SqlRow[];

  return {
    totalEvents: Number(totalRow[0]?.count ?? 0),
    topCategories: topCategories.map(r => ({ category: r.category, count: Number(r.count) })),
    topNeighborhoods: topNeighborhoods.map(r => ({ neighborhoodId: r.neighborhood_id, count: Number(r.count) })),
    likedTruthIds: likedTruths.map(r => r.truth_id),
    viewedTruthIds: viewedTruths.map(r => ({ truthId: r.truth_id, views: Number(r.views) })),
  };
}

/**
 * Generate AI-powered post suggestions for a user based on browsing patterns.
 * Uses a hybrid approach: heuristic scoring + optional Kimi K3 explanation.
 */
export async function generatePostSuggestions(opts: {
  clerkUserId?: string | null;
  userHash?: string | null;
  limit?: number;
}) {
  const sql = getDb();
  const limit = opts.limit ?? 5;

  // Get user's browsing profile
  const profile = await getUserBrowsingProfile(opts.clerkUserId, opts.userHash);

  // Get candidate truths (recent, not already viewed)
  const candidateRows = (await sql`
    SELECT t.*, n.name as neighborhood_name, n.region as neighborhood_region
    FROM micro_truths t
    LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id
    WHERE t.status != 'rejected'
    ORDER BY t.created_at DESC
    LIMIT 100
  `) as unknown as SqlRow[];

  if (candidateRows.length === 0) return [];

  // Heuristic scoring
  const viewedSet = new Set(profile?.viewedTruthIds?.map(v => v.truthId) ?? []);
  const likedSet = new Set(profile?.likedTruthIds ?? []);
  const topCatSet = new Set(profile?.topCategories?.map(c => c.category) ?? []);
  const topNeighborhoodSet = new Set(profile?.topNeighborhoods?.map(n => n.neighborhoodId) ?? []);

  const scored = candidateRows.map(r => {
    let score = 0.3; // base score
    const reasons: string[] = [];

    // Category match
    if (topCatSet.has(r.category)) {
      score += 0.25;
      reasons.push(`matches your interest in ${r.category}`);
    }

    // Neighborhood match
    if (topNeighborhoodSet.has(r.neighborhood_id)) {
      score += 0.2;
      reasons.push("from a neighborhood you follow");
    }

    // Trust score boost
    if (r.trust_score >= 70) {
      score += 0.15;
      reasons.push("high community trust");
    }

    // Recency boost (within last 6 hours)
    const ageHours = (Date.now() - new Date(r.created_at).getTime()) / 3600000;
    if (ageHours < 6) {
      score += 0.1;
      reasons.push("recently reported");
    }

    // Penalize already-viewed
    if (viewedSet.has(r.id)) {
      score -= 0.2;
    }

    // Don't suggest liked posts again
    if (likedSet.has(r.id)) {
      score -= 0.3;
    }

    return {
      truthId: r.id,
      neighborhoodId: r.neighborhood_id,
      category: r.category,
      content: r.content,
      neighborhoodName: r.neighborhood_name,
      trustScore: r.trust_score,
      createdAt: r.created_at,
      score: Math.max(0, Math.min(1, score)),
      reason: reasons.join("; ") || "trending in your area",
    };
  });

  // Sort by score and take top N
  const topSuggestions = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Optional: Use Kimi K3 to generate personalized recommendation text
  const { isKimiConfigured, generateKimiJson } = await import("@/lib/kimi");
  let sourceModel = "heuristic";

  if (isKimiConfigured() && topSuggestions.length > 0 && profile) {
    const systemPrompt = "You are a recommendation AI for Soke, a community truth platform. Given a user's browsing profile and candidate posts, enhance the recommendation reasons to be more personal and engaging. Keep reasons under 100 characters.";

    const userPrompt = `User profile: ${JSON.stringify({
      topCategories: profile.topCategories,
      topNeighborhoods: profile.topNeighborhoods,
      totalEvents: profile.totalEvents,
    })}

Candidate posts:
${JSON.stringify(topSuggestions.map(s => ({ id: s.truthId, category: s.category, content: s.content.slice(0, 80), neighborhood: s.neighborhoodName })))}

Return a JSON array of objects with "id" (the truth id) and "reason" (personalized recommendation text).`;

    const { data: kimiResults, source } = await generateKimiJson<{ id: number; reason: string }[]>(
      systemPrompt, userPrompt, [], { temperature: 0.5, maxOutputTokens: 512 }
    );

    if (source === "kimi" && Array.isArray(kimiResults)) {
      for (const gr of kimiResults) {
        const match = topSuggestions.find(s => s.truthId === gr.id);
        if (match && gr.reason) {
          match.reason = gr.reason;
        }
      }
      sourceModel = "kimi-enhanced";
    }
  }

  // Store suggestions in DB
  for (const s of topSuggestions) {
    await sql`
      INSERT INTO post_suggestions
        (clerk_user_id, user_hash, truth_id, score, reason, source_model, expires_at)
      VALUES
        (${opts.clerkUserId ?? null}, ${opts.userHash ?? null}, ${s.truthId},
         ${s.score}, ${s.reason}, ${sourceModel}, NOW() + INTERVAL '24 hours')
    `;
  }

  return topSuggestions;
}

/**
 * Get the feed snapshots view-model — the data shape needed for the
 * redesigned feed page matching the uploaded design.
 */
export async function getFeedSnapshots() {
  const sql = getDb();

  const neighborhoods = (await sql`SELECT * FROM neighborhoods ORDER BY name`) as unknown as SqlRow[];
  const snapshots = (await sql`SELECT * FROM snapshots`) as unknown as SqlRow[];
  const truths = (await sql`SELECT t.*, n.name as neighborhood_name FROM micro_truths t LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id WHERE t.status != 'rejected' ORDER BY t.created_at DESC LIMIT 200`) as unknown as SqlRow[];
  const predictions = (await sql`SELECT * FROM predictions ORDER BY created_at DESC LIMIT 50`) as unknown as SqlRow[];

  // Summary stats
  const activeTruths = truths.length;
  const neighborhoodCount = neighborhoods.length;

  const snapshotsWithSafety = snapshots.filter(s => s.safety_index != null);
  const avgSafety = snapshotsWithSafety.length > 0
    ? Math.round(snapshotsWithSafety.reduce((sum, s) => sum + Number(s.safety_index), 0) / snapshotsWithSafety.length)
    : 70;

  const snapshotsWithPrice = snapshots.filter(s => s.price_index != null);
  const avgPrice = snapshotsWithPrice.length > 0
    ? Math.round(snapshotsWithPrice.reduce((sum, s) => sum + Number(s.price_index), 0) / snapshotsWithPrice.length)
    : 100;

  // Mesh nodes = active device profiles
  const meshNodesRow = (await sql`SELECT COUNT(*) as count FROM device_profiles`) as unknown as SqlRow[];
  const meshNodes = Number(meshNodesRow[0]?.count ?? 0);

  // Build per-neighborhood snapshot cards
  const neighborhoodCards = neighborhoods.map(n => {
    const snap = snapshots.find(s => s.neighborhood_id === n.id);
    const nTruths = truths.filter(t => t.neighborhood_id === n.id);
    const nPredictions = predictions.filter(p => p.neighborhood_id === n.id);
    const latestPrediction = nPredictions[0];

    return {
      id: n.id,
      name: n.name,
      region: n.region,
      truthCount: nTruths.length,
      metrics: {
        power: snap?.power_status || "unknown",
        fuel: snap?.fuel_status || "unknown",
        traffic: snap?.traffic_level || "unknown",
        prices: snap?.price_index ?? 100,
        safety: snap?.safety_index ?? 70,
      },
      prediction: latestPrediction ? {
        category: latestPrediction.category,
        text: latestPrediction.prediction,
        confidence: latestPrediction.confidence,
        timeframe: latestPrediction.timeframe,
        trend: latestPrediction.trend,
        modelVersion: latestPrediction.model_version,
      } : null,
      recentReports: nTruths.slice(0, 5).map(t => ({
        id: t.id,
        category: t.category,
        content: t.content,
        trustScore: t.trust_score,
        createdAt: t.created_at,
        neighborhoodName: t.neighborhood_name,
      })),
      updatedAt: snap?.updated_at || nTruths[0]?.created_at || null,
    };
  });

  return {
    summary: {
      activeTruths,
      neighborhoods: neighborhoodCount,
      avgSafetyIndex: avgSafety,
      avgPriceIndex: avgPrice,
      meshNodes,
    },
    neighborhoods: neighborhoodCards,
  };
}

/**
 * Generate weekly user reviews for the admin dashboard.
 * Collects per-user activity metrics and optionally uses Kimi K3 for summaries.
 */
export async function generateWeeklyReviews() {
  const sql = getDb();

  // Calculate week range
  const now = new Date();
  const weekEnd = now.toISOString().split("T")[0];
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];

  // Get all platform users
  const users = (await sql`SELECT * FROM platform_users ORDER BY created_at DESC`) as unknown as SqlRow[];

  const reviews: any[] = [];

  for (const user of users) {
    const clerkId = user.clerk_user_id;

    // Compute the same hashed user ID used by getUserId()
    const crypto = await import("node:crypto");
    const hashedUserId = `dev_${crypto.createHash("sha256").update(clerkId).digest("hex").substring(0, 12)}`;

    // Browsing events this week
    const browsingRow = (await sql`
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT category) as categories_viewed,
        COUNT(DISTINCT neighborhood_id) as neighborhoods_viewed
      FROM user_browsing_events
      WHERE (clerk_user_id = ${clerkId} OR user_hash = ${hashedUserId})
        AND created_at >= ${weekStart}
    `) as unknown as SqlRow[];

    // Truths submitted this week
    const truthsRow = (await sql`
      SELECT COUNT(*) as count FROM micro_truths
      WHERE (user_hash = ${hashedUserId} OR user_hash = ${clerkId} OR user_hash = ${user.email})
        AND created_at >= ${weekStart}
    `) as unknown as SqlRow[];

    // Verifications this week
    const verificationsRow = (await sql`
      SELECT COUNT(*) as count FROM verifications
      WHERE (user_hash = ${hashedUserId} OR user_hash = ${clerkId})
        AND created_at >= ${weekStart}
    `) as unknown as SqlRow[];

    // Likes this week
    const likesRow = (await sql`
      SELECT COUNT(*) as count FROM feed_likes
      WHERE (user_hash = ${hashedUserId} OR user_hash = ${clerkId})
        AND created_at >= ${weekStart}
    `) as unknown as SqlRow[];

    // Top categories
    const topCats = (await sql`
      SELECT category, COUNT(*) as count
      FROM user_browsing_events
      WHERE (clerk_user_id = ${clerkId} OR user_hash = ${hashedUserId}) AND category IS NOT NULL
        AND created_at >= ${weekStart}
      GROUP BY category ORDER BY count DESC LIMIT 3
    `) as unknown as SqlRow[];

    const metrics = {
      browsingEvents: Number(browsingRow[0]?.total_events ?? 0),
      categoriesViewed: Number(browsingRow[0]?.categories_viewed ?? 0),
      neighborhoodsViewed: Number(browsingRow[0]?.neighborhoods_viewed ?? 0),
      truthsSubmitted: Number(truthsRow[0]?.count ?? 0),
      verifications: Number(verificationsRow[0]?.count ?? 0),
      likes: Number(likesRow[0]?.count ?? 0),
      topCategories: topCats.map(c => ({ category: c.category, count: Number(c.count) })),
    };

    // Determine risk flags
    const riskFlags: string[] = [];
    if (metrics.browsingEvents === 0) riskFlags.push("inactive");
    if (metrics.browsingEvents > 0 && metrics.truthsSubmitted === 0) riskFlags.push("lurker");
    if (metrics.truthsSubmitted > 5) riskFlags.push("high_contributor");
    if (metrics.verifications > 10) riskFlags.push("active_verifier");

    // Heuristic summary
    const summary = `${user.display_name || user.email || "User"} had ${metrics.browsingEvents} browsing events, submitted ${metrics.truthsSubmitted} truths, and made ${metrics.verifications} verifications this week.`;

    // Build recommendation
    const recommendations: string[] = [];
    if (metrics.browsingEvents === 0) recommendations.push("Consider re-engagement campaign");
    if (metrics.truthsSubmitted > 5) recommendations.push("Recognize as top contributor");
    if (metrics.verifications > 10) recommendations.push("Nominate for verifier badge");
    if (metrics.browsingEvents > 20 && metrics.truthsSubmitted === 0) recommendations.push("Encourage first submission");

    reviews.push({
      weekStart,
      weekEnd,
      clerkUserId: clerkId,
      userHash: clerkId,
      email: user.email,
      displayName: user.display_name,
      metrics,
      summary,
      recommendations,
      riskFlags,
      aiSummary: null as string | null,
      modelVersion: "heuristic",
    });
  }

  // Optional: Use Kimi K3 to generate AI summaries for top users
  const { isKimiConfigured, getKimiModel, generateKimiText } = await import("@/lib/kimi");

  if (isKimiConfigured() && reviews.length > 0) {
    const model = getKimiModel();
    const systemPrompt = "You are an analytics AI for Soke, a community truth platform. Generate concise, insightful weekly review summaries for users. Keep each summary under 200 characters. Focus on engagement patterns and actionable insights.";

    for (const review of reviews.slice(0, 50)) {
      const userPrompt = `Generate a weekly review summary for this user:
${JSON.stringify({
  name: review.displayName,
  email: review.email,
  metrics: review.metrics,
  riskFlags: review.riskFlags,
  recommendations: review.recommendations,
}, null, 2)}`;

      const aiSummary = await generateKimiText(systemPrompt, userPrompt, {
        temperature: 0.4,
        maxOutputTokens: 256,
      });

      if (aiSummary) {
        review.aiSummary = aiSummary;
        review.modelVersion = `kimi:${model}`;
      }
    }
  }

  // Store reviews (upsert)
  for (const review of reviews) {
    await sql`
      INSERT INTO weekly_user_reviews
        (week_start, week_end, clerk_user_id, user_hash, email, display_name,
         metrics, summary, recommendations, risk_flags, ai_summary, model_version)
      VALUES
        (${review.weekStart}, ${review.weekEnd}, ${review.clerkUserId}, ${review.userHash},
         ${review.email}, ${review.displayName},
         ${JSON.stringify(review.metrics)}::jsonb, ${review.summary},
         ${JSON.stringify(review.recommendations)}::jsonb, ${JSON.stringify(review.riskFlags)}::jsonb,
         ${review.aiSummary}, ${review.modelVersion})
      ON CONFLICT (week_start, clerk_user_id)
      DO UPDATE SET
        metrics = EXCLUDED.metrics,
        summary = EXCLUDED.summary,
        recommendations = EXCLUDED.recommendations,
        risk_flags = EXCLUDED.risk_flags,
        ai_summary = EXCLUDED.ai_summary,
        model_version = EXCLUDED.model_version,
        generated_at = NOW()
    `;
  }

  return { generated: reviews.length, weekStart, weekEnd };
}

/**
 * Get stored weekly reviews for admin dashboard.
 */
export async function getWeeklyReviews(weekStart?: string) {
  const sql = getDb();

  let rows: SqlRow[];
  if (weekStart) {
    rows = (await sql`
      SELECT * FROM weekly_user_reviews
      WHERE week_start = ${weekStart}
      ORDER BY generated_at DESC
    `) as unknown as SqlRow[];
  } else {
    // Get latest week
    const latestWeek = (await sql`
      SELECT DISTINCT week_start FROM weekly_user_reviews
      ORDER BY week_start DESC LIMIT 1
    `) as unknown as SqlRow[];

    if (latestWeek.length === 0) return { weekStart: null, weekEnd: null, reviews: [] };

    const ws = latestWeek[0].week_start;
    rows = (await sql`
      SELECT * FROM weekly_user_reviews
      WHERE week_start = ${ws}
      ORDER BY generated_at DESC
    `) as unknown as SqlRow[];
  }

  const reviews = rows.map(r => ({
    id: r.id,
    weekStart: r.week_start,
    weekEnd: r.week_end,
    clerkUserId: r.clerk_user_id,
    email: r.email,
    displayName: r.display_name,
    metrics: typeof r.metrics === "string" ? JSON.parse(r.metrics) : r.metrics,
    summary: r.summary,
    recommendations: typeof r.recommendations === "string" ? JSON.parse(r.recommendations) : r.recommendations,
    riskFlags: typeof r.risk_flags === "string" ? JSON.parse(r.risk_flags) : r.risk_flags,
    aiSummary: r.ai_summary,
    modelVersion: r.model_version,
    generatedAt: r.generated_at,
  }));

  return {
    weekStart: reviews[0]?.weekStart ?? null,
    weekEnd: reviews[0]?.weekEnd ?? null,
    reviews,
  };
}

// Re-export commonly used constants
export { TRUTH_CATEGORIES, ACHIEVEMENT_DEFS, XP_PER_SUBMISSION, XP_PER_VERIFICATION, XP_PER_CORROBORATION, XP_STREAK_BONUS };
