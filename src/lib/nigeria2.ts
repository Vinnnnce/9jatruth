/**
 * Nigeria 2.0 open election API client.
 * Docs: https://api.nigeria2.com — no key, CORS-open, returns JSON.
 *
 * Server-side only (used by API routes). In-memory cache with TTL so we don't
 * hammer the public API on every request. All data is "evidence" (transcription
 * of INEC result sheets), NOT an official count — surface that in the UI.
 */

const BASE = "https://api.nigeria2.com";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEntry {
  data: any;
  expires: number;
}
const cache = new Map<string, CacheEntry>();

async function fetchJson(path: string): Promise<any> {
  const url = `${BASE}${path}`;
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.data;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    // Next.js fetch caching on serverless; fall back to no-store.
    cache: "no-store" as RequestCache,
  });
  if (!res.ok) {
    throw new Error(`Nigeria2 ${path} -> ${res.status}`);
  }
  const data = await res.json();
  cache.set(url, { data, expires: Date.now() + TTL_MS });
  return data;
}

export interface Nigeria2State {
  geo_id: string;
  name: string;
}
export async function getStates(): Promise<{ count: number; states: Nigeria2State[] }> {
  return fetchJson("/api/v1/states");
}

export interface Nigeria2Party {
  acronym: string;
  name: string;
  chairman?: string;
  active?: boolean;
}
export async function getParties(activeOnly = true): Promise<{ count: number; parties: Nigeria2Party[] }> {
  return fetchJson(`/api/v1/parties${activeOnly ? "?active=true" : ""}`);
}
export async function getParty(acronym: string): Promise<Nigeria2Party> {
  return fetchJson(`/api/v1/parties/${encodeURIComponent(acronym)}`);
}

export interface Nigeria2Results {
  year: number;
  states?: any[];
  summary?: any;
}
export async function getResults(year: number): Promise<Nigeria2Results> {
  return fetchJson(`/api/v1/results/${year}`);
}
export async function getStateResults(year: number, geoId: string): Promise<any> {
  return fetchJson(`/api/v1/results/${year}/${encodeURIComponent(geoId)}`);
}

export interface Nigeria2Outlier {
  pu_code?: string;
  state?: string;
  office?: string;
  rule?: string;
  [k: string]: any;
}
export async function getOutliers(year: number, params?: { state?: string; office?: string; rule?: string; limit?: number; offset?: number }): Promise<{ count?: number; has_more?: boolean; next_offset?: number; outliers?: Nigeria2Outlier[]; [k: string]: any }> {
  const qs = new URLSearchParams();
  if (params?.state) qs.set("state", params.state);
  if (params?.office) qs.set("office", params.office);
  if (params?.rule) qs.set("rule", params.rule);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const q = qs.toString();
  return fetchJson(`/api/v1/outliers/${year}${q ? "?" + q : ""}`);
}

/** Resolve a canonical state name (e.g. "Akwa Ibom") to its Nigeria2 geo_id. */
export async function getGeoIdForState(stateName: string): Promise<string | null> {
  const { states } = await getStates();
  const target = stateName.toLowerCase().trim();
  const match = states.find((s) => s.name.toLowerCase() === target);
  return match?.geo_id ?? null;
}
