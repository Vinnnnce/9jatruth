/**
 * Reverse-geocoding + Nigerian geo-hierarchy assignment for the Community Feeds system.
 * ─────────────────────────────────────────────────────────────────────────────
 * Server-only. No API key required — uses BigDataCloud's keyless reverse-geocode
 * endpoint, with Nominatim (OpenStreetMap) as a fallback (rate-limited, real UA).
 *
 * Pipeline (lat/lng → state → LGA → ward → community):
 *   1. Reverse-geocode coordinates → administrative locality names.
 *   2. Normalize & fuzzy-match the state against the static NIGERIA_STATES list.
 *   3. Match the LGA against NIGERIA_LGAS[state].
 *   4. Resolve the ward by nearest known ward centroid within the LGA (or name match).
 *   5. Resolve the community by nearest known community centroid (or name match).
 *
 * Returns denormalized names AND confidence + source so the caller can persist
 * both the resolved IDs and a human-readable location. Manual overrides supplied
 * by the user always take precedence over auto-detected values.
 */

import { getDb } from "@/lib/db";
import { NIGERIA_STATES, NIGERIA_LGAS } from "@/lib/nigeria-locations";

export interface GeoAssignment {
  stateName: string | null;
  lgaName: string | null;
  wardName: string | null;
  communityName: string | null;
  regionName: string | null;
  stateId: number | null;
  lgaId: number | null;
  wardId: number | null;
  communityId: number | null;
  lat: number | null;
  lng: number | null;
  source: string; // "browser" | "reverse-geocode" | "manual" | "ip" | "ai" | "unknown"
  assignmentConfidence: number; // 0–100
  raw?: unknown;
}

// ─── String normalization ─────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\bstate\b/g, "")
    .replace(/\bfederal capital territory\b/g, "fct")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

/** Find the closest match in `candidates` to `target`. Returns [value, score 0–1]. */
function bestMatch(target: string, candidates: string[]): { value: string | null; score: number } {
  const t = normalize(target);
  if (!t || candidates.length === 0) return { value: null, score: 0 };
  let best: string | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const cn = normalize(c);
    if (!cn) continue;
    if (cn === t) return { value: c, score: 1 };
    // containment is a strong signal ("ikeja" inside "ikeja local government")
    const containment = cn.includes(t) || t.includes(cn) ? 0.85 : 0;
    const maxLen = Math.max(cn.length, t.length);
    const dist = levenshtein(cn, t);
    const ratio = 1 - dist / maxLen;
    const score = Math.max(ratio, containment);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { value: best, score: bestScore };
}

// ─── Reverse geocoding providers ──────────────────────────────────────────

interface ReverseGeocodeResult {
  state: string | null;
  lga: string | null;
  locality: string | null;
  region: string | null;
  country: string | null;
  raw: unknown;
}

/**
 * BigDataCloud reverse-geocode-client — keyless, CORS-friendly, no rate-limit
 * issues for this volume. Returns administrative areas + locality info.
 */
async function reverseGeocodeBigDataCloud(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${lat}&longitude=${lng}&localityLanguage=en`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Server-side fetch — no UA restrictions.
    });
    if (!res.ok) return null;
    const data = await res.json();
    const principal = data?.principalSubdivision || null;
    const locality = data?.localityInfo?.administrative || [];
    // Walk the administrative hierarchy (smallest → largest).
    const adminNames: string[] = Array.isArray(locality)
      ? locality.map((a: any) => a?.name).filter(Boolean)
      : [];
    const city = data?.city || data?.locality || data?.principalSubdivision || null;
    return {
      state: principal,
      lga: adminNames.length >= 2 ? adminNames[adminNames.length - 2] : adminNames[0] || city,
      locality: city,
      region: null,
      country: data?.countryName || null,
      raw: data,
    };
  } catch (err) {
    console.warn("[geo-reverse] BigDataCloud failed:", (err as Error)?.message);
    return null;
  }
}

/**
 * Nominatim (OpenStreetMap) fallback — 1 req/s, requires a descriptive UA.
 * Only used when BigDataCloud returns nothing.
 */
async function reverseGeocodeNominatim(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lng}&zoom=12&accept-language=en`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "9jatruth-community-feeds/1.0 (9jatruthofficial@gmail.com)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data?.address || {};
    const state =
      addr.state || addr.state_district || addr.region || data?.name || null;
    const lga =
      addr.county ||
      addr.local_government_area ||
      addr.municipality ||
      addr.city_district ||
      addr.town ||
      addr.city ||
      null;
    return {
      state,
      lga,
      locality: addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || null,
      region: null,
      country: addr.country || null,
      raw: data,
    };
  } catch (err) {
    console.warn("[geo-reverse] Nominatim failed:", (err as Error)?.message);
    return null;
  }
}

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult | null> {
  return (
    (await reverseGeocodeBigDataCloud(lat, lng)) ||
    (await reverseGeocodeNominatim(lat, lng))
  );
}

// ─── DB resolution helpers ────────────────────────────────────────────────

async function resolveStateId(name: string): Promise<{ id: number | null; region: string | null }> {
  const sql = getDb();
  const rows = (await sql`SELECT id, name FROM states`) as unknown as Array<{
    id: number;
    name: string;
  }>;
  const match = bestMatch(name, rows.map((r) => r.name));
  if (match.value && match.score >= 0.8) {
    const row = rows.find((r) => r.name === match.value);
    const regionRow = row
      ? ((await sql`SELECT r.name as region FROM states s LEFT JOIN regions r ON s.region_id = r.id WHERE s.id = ${row.id}`) as unknown as Array<{ region: string | null }>)
      : null;
    return { id: row?.id ?? null, region: regionRow?.[0]?.region ?? null };
  }
  return { id: null, region: null };
}

async function resolveLgaId(stateId: number | null, lgaName: string): Promise<number | null> {
  const sql = getDb();
  const rows = (await sql`SELECT id, name FROM lgas WHERE state_id = ${stateId}`) as unknown as Array<{
    id: number;
    name: string;
  }>;
  const match = bestMatch(lgaName, rows.map((r) => r.name));
  if (match.value && match.score >= 0.8) {
    return rows.find((r) => r.name === match.value)?.id ?? null;
  }
  return null;
}

async function resolveWardByCentroid(
  lgaId: number | null,
  lat: number,
  lng: number
): Promise<{ id: number | null; name: string | null; distanceKm: number }> {
  if (!lgaId) return { id: null, name: null, distanceKm: Infinity };
  const sql = getDb();
  const rows = (await sql`
    SELECT id, name, lat, lng FROM wards
    WHERE lga_id = ${lgaId} AND lat IS NOT NULL AND lng IS NOT NULL
  `) as unknown as Array<{ id: number; name: string; lat: number; lng: number }>;
  if (rows.length === 0) return { id: null, name: null, distanceKm: Infinity };
  let best = rows[0];
  let bestDist = Infinity;
  for (const w of rows) {
    const dist = haversineKm(lat, lng, w.lat, w.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = w;
    }
  }
  return { id: best.id, name: best.name, distanceKm: bestDist };
}

async function resolveWardByName(lgaId: number | null, wardName: string): Promise<number | null> {
  if (!lgaId) return null;
  const sql = getDb();
  const rows = (await sql`SELECT id, name FROM wards WHERE lga_id = ${lgaId}`) as unknown as Array<{
    id: number;
    name: string;
  }>;
  const match = bestMatch(wardName, rows.map((r) => r.name));
  if (match.value && match.score >= 0.7) {
    return rows.find((r) => r.name === match.value)?.id ?? null;
  }
  return null;
}

async function resolveCommunityByCentroid(
  lat: number,
  lng: number,
  radiusKm = 50
): Promise<{ id: number | null; name: string | null; distanceKm: number }> {
  const sql = getDb();
  const rows = (await sql`
    SELECT id, name, lat, lng FROM communities WHERE lat IS NOT NULL AND lng IS NOT NULL
  `) as unknown as Array<{ id: number; name: string; lat: number; lng: number }>;
  if (rows.length === 0) return { id: null, name: null, distanceKm: Infinity };
  let best: typeof rows[number] | null = null;
  let bestDist = Infinity;
  for (const c of rows) {
    const dist = haversineKm(lat, lng, c.lat, c.lng);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  if (!best || bestDist > radiusKm) return { id: null, name: null, distanceKm: bestDist };
  return { id: best.id, name: best.name, distanceKm: bestDist };
}

// ─── Haversine ──────────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface AssignLocationInput {
  lat?: number | null;
  lng?: number | null;
  source?: string;
  // Manual overrides (always win)
  stateName?: string | null;
  lgaName?: string | null;
  wardName?: string | null;
  communityName?: string | null;
}

/**
 * Assign a full geo hierarchy from coordinates (or manual overrides).
 * This is the core of "auto-assign state → LGA → ward → community".
 */
export async function assignLocationFromCoordinates(
  input: AssignLocationInput
): Promise<GeoAssignment> {
  const manualState = input.stateName?.trim() || null;
  const manualLga = input.lgaName?.trim() || null;
  const manualWard = input.wardName?.trim() || null;
  const manualCommunity = input.communityName?.trim() || null;

  const hasCoords =
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    !Number.isNaN(input.lat) &&
    !Number.isNaN(input.lng) &&
    input.lat >= -90 &&
    input.lat <= 90;

  // 1. Determine state name (manual override > reverse-geocode > static guess)
  let stateName: string | null = manualState;
  let lgaName: string | null = manualLga;
  let wardName: string | null = manualWard;
  let communityName: string | null = manualCommunity;
  let reverseRaw: ReverseGeocodeResult | null = null;
  let source = input.source || "unknown";

  if (hasCoords && (!stateName || !lgaName)) {
    reverseRaw = await reverseGeocode(input.lat as number, input.lng as number);
    if (reverseRaw) {
      source = "reverse-geocode";
      if (!stateName && reverseRaw.state) {
        const sm = bestMatch(reverseRaw.state, NIGERIA_STATES);
        if (sm.value && sm.score >= 0.8) stateName = sm.value;
      }
      if (!lgaName && reverseRaw.lga) {
        // Match against the static LGA list for the resolved state (if known).
        const stateLgas = stateName ? NIGERIA_LGAS[stateName] || [] : [];
        if (stateLgas.length > 0) {
          const lm = bestMatch(reverseRaw.lga, stateLgas);
          if (lm.value && lm.score >= 0.8) lgaName = lm.value;
        }
        if (!lgaName) lgaName = reverseRaw.lga; // keep raw for fuzzy DB match
      }
      if (!communityName && reverseRaw.locality) {
        communityName = reverseRaw.locality;
      }
    }
  }

  // 2. Resolve IDs from the DB (fuzzy by name).
  const stateRes = stateName ? await resolveStateId(stateName) : { id: null, region: null };
  const stateId = stateRes.id;
  const regionName = stateRes.region;
  const lgaId = lgaName ? await resolveLgaId(stateId, lgaName) : null;

  // 3. Ward resolution: manual name → nearest centroid within LGA → reverse locality
  let wardId: number | null = null;
  if (wardName && lgaId) {
    wardId = await resolveWardByName(lgaId, wardName);
  }
  let wardCentroidDist = Infinity;
  if (!wardId && hasCoords && lgaId) {
    const wc = await resolveWardByCentroid(lgaId, input.lat as number, input.lng as number);
    wardId = wc.id;
    if (!wardName) wardName = wc.name;
    wardCentroidDist = wc.distanceKm;
  }
  if (!wardName && reverseRaw?.locality) wardName = reverseRaw.locality;

  // 4. Community resolution: nearest centroid within radius
  let communityId: number | null = null;
  let communityDist = Infinity;
  if (hasCoords) {
    const cc = await resolveCommunityByCentroid(input.lat as number, input.lng as number);
    communityId = cc.id;
    if (!communityName) communityName = cc.name;
    communityDist = cc.distanceKm;
  }

  // 5. Confidence score
  let confidence = 0;
  if (stateName) confidence += 30;
  if (lgaName && lgaId) confidence += 25;
  if (wardId) confidence += 25;
  if (communityId) confidence += 20;
  if (manualState && manualLga) confidence = Math.max(confidence, 90);
  if (wardCentroidDist !== Infinity && wardCentroidDist > 15) confidence -= 10;
  if (communityDist !== Infinity && communityDist > 30) confidence -= 5;
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    stateName,
    lgaName,
    wardName,
    communityName,
    regionName,
    stateId,
    lgaId,
    wardId,
    communityId,
    lat: hasCoords ? (input.lat as number) : null,
    lng: hasCoords ? (input.lng as number) : null,
    source,
    assignmentConfidence: confidence,
    raw: reverseRaw?.raw ?? undefined,
  };
}

/**
 * Resolve or create a ward row from a name + LGA. Used during feed creation
 * when a user supplies a ward that doesn't exist yet in the reference data.
 */
export async function resolveOrCreateWard(
  lgaId: number | null,
  stateId: number | null,
  wardName: string,
  lat?: number | null,
  lng?: number | null
): Promise<number | null> {
  if (!wardName || !lgaId) return null;
  const sql = getDb();
  const existing = (await sql`SELECT id FROM wards WHERE lga_id = ${lgaId} AND name ILIKE ${wardName} LIMIT 1`) as unknown as Array<{
    id: number;
  }>;
  if (existing.length > 0) return existing[0].id;
  try {
    const created = (await sql`INSERT INTO wards (name, state_id, lga_id, lat, lng, source) VALUES (${wardName}, ${stateId}, ${lgaId}, ${lat ?? null}, ${lng ?? null}, 'user') RETURNING id`) as unknown as Array<{
      id: number;
    }>;
    return created[0]?.id ?? null;
  } catch {
    // Race condition — re-fetch.
    const retry = (await sql`SELECT id FROM wards WHERE lga_id = ${lgaId} AND name ILIKE ${wardName} LIMIT 1`) as unknown as Array<{
      id: number;
    }>;
    return retry[0]?.id ?? null;
  }
}
