import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * Centralized, cached config access for SiteConfig / FeatureConfig / RewardsConfig.
 *
 * Why: super-admin dashboard updates must reflect "instantly" across the app
 * without every request hitting the DB. We keep a short-TTL in-memory cache
 * (default 15s) that is also invalidated the moment a config mutation emits a
 * `*.config.updated` event. The next read after invalidation pulls fresh data.
 *
 * Event-based invalidation:
 *   - emitConfigEvent('rewards.config.updated', payload)  → busts rewards cache
 *   - emitConfigEvent('site.config.updated', payload)      → busts site cache
 *   - emitConfigEvent('feature.config.updated', payload)   → busts feature cache
 * Every emit is also written to the `config_events` table for an audit trail.
 */

export type SiteConfig = {
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  homepage_banner_text: string | null;
  announcement_bar: { active: boolean; text: string; type: string };
  referral_base_url: string;
  default_rewards_config_id: number | null;
};

export type FeatureConfig = {
  news_enabled: boolean;
  rewards_enabled: boolean;
  politics_enabled: boolean;
  questionnaire_enabled: boolean;
  ai_compare_enabled: boolean;
};

export type RewardsConfig = {
  id: number;
  name: string;
  is_active: boolean;
  config: Record<string, number | string | boolean>;
};

const DEFAULT_SITE: SiteConfig = {
  primary_color: "#0f766e",
  secondary_color: "#f59e0b",
  logo_url: null,
  homepage_banner_text: null,
  announcement_bar: { active: false, text: "", type: "info" },
  referral_base_url: process.env.NEXT_PUBLIC_REFERRAL_BASE_URL || "https://9jatruth.com",
  default_rewards_config_id: null,
};

const DEFAULT_FEATURE: FeatureConfig = {
  news_enabled: true,
  rewards_enabled: true,
  politics_enabled: true,
  questionnaire_enabled: true,
  ai_compare_enabled: true,
};

const DEFAULT_REWARDS_CONFIG: Record<string, number> = {
  truthSubmission: 20,
  corroboration: 10,
  aiVerified: 15,
  dailyStreak: 5,
  disputedPenalty: -10,
  referralSignup: 50,
  referralCompletion: 100,
};

type CacheEntry<T> = { value: T; expiresAt: number };
const TTL_MS = 15_000; // 15 seconds — short enough to feel live, cheap on the DB
const cache: Record<string, CacheEntry<any>> = {};

function isFresh(key: string): boolean {
  const e = cache[key];
  return !!e && e.expiresAt > Date.now();
}

function bust(prefix: "site" | "feature" | "rewards") {
  for (const key of Object.keys(cache)) {
    if (key.startsWith(prefix)) delete cache[key];
  }
}

/** Emit a config-updated event, bust the relevant cache, and log to config_events. */
export async function emitConfigEvent(
  eventName: "rewards.config.updated" | "site.config.updated" | "feature.config.updated",
  payload: Record<string, unknown> = {},
  emittedBy?: string
): Promise<void> {
  // Bust the in-memory cache immediately (works across the same instance).
  if (eventName === "rewards.config.updated") bust("rewards");
  if (eventName === "site.config.updated") bust("site");
  if (eventName === "feature.config.updated") bust("feature");

  // Persist the event for cross-instance invalidation + audit.
  try {
    await ensureDbInitialized();
    const sql = getDb();
    await sql`INSERT INTO config_events (event_name, payload, emitted_by)
      VALUES (${eventName}, ${JSON.stringify(payload)}::jsonb, ${emittedBy ?? null})`;
  } catch (err) {
    console.error("[config] emitConfigEvent non-fatal:", err);
  }
}

/** Returns the seconds since the latest config event for a given name (cross-instance staleness signal). */
export async function lastEventAgeSeconds(eventName: string): Promise<number | null> {
  try {
    await ensureDbInitialized();
    const sql = getDb();
    const rows = (await sql`SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age
      FROM config_events WHERE event_name = ${eventName} ORDER BY created_at DESC LIMIT 1`) as any;
    if (rows && rows.length > 0) return rows[0].age;
  } catch {
    // ignore
  }
  return null;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  if (isFresh("site")) return cache["site"].value;
  try {
    await ensureDbInitialized();
    const sql = getDb();
    const rows = (await sql`SELECT * FROM site_config WHERE id = 1 LIMIT 1`) as any;
    if (rows && rows.length > 0) {
      const r = rows[0];
      let announcement = DEFAULT_SITE.announcement_bar;
      try {
        announcement = typeof r.announcement_bar === "string"
          ? { ...DEFAULT_SITE.announcement_bar, ...JSON.parse(r.announcement_bar) }
          : { ...DEFAULT_SITE.announcement_bar, ...(r.announcement_bar || {}) };
      } catch {
        // keep default
      }
      const value: SiteConfig = { ...DEFAULT_SITE, ...r, announcement_bar: announcement };
      cache["site"] = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    }
  } catch (err) {
    console.error("[config] getSiteConfig non-fatal:", err);
  }
  cache["site"] = { value: DEFAULT_SITE, expiresAt: Date.now() + TTL_MS };
  return DEFAULT_SITE;
}

export async function getFeatureConfig(): Promise<FeatureConfig> {
  if (isFresh("feature")) return cache["feature"].value;
  try {
    await ensureDbInitialized();
    const sql = getDb();
    const rows = (await sql`SELECT * FROM feature_config WHERE id = 1 LIMIT 1`) as any;
    if (rows && rows.length > 0) {
      const value: FeatureConfig = { ...DEFAULT_FEATURE, ...rows[0] };
      cache["feature"] = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    }
  } catch (err) {
    console.error("[config] getFeatureConfig non-fatal:", err);
  }
  cache["feature"] = { value: DEFAULT_FEATURE, expiresAt: Date.now() + TTL_MS };
  return DEFAULT_FEATURE;
}

export async function getRewardsConfig(): Promise<RewardsConfig> {
  if (isFresh("rewards")) return cache["rewards"].value;
  try {
    await ensureDbInitialized();
    const sql = getDb();
    // Active config wins; otherwise the default_rewards_config_id; otherwise the latest.
    let rows = (await sql`SELECT * FROM rewards_config WHERE is_active = TRUE ORDER BY updated_at DESC LIMIT 1`) as any;
    if (!rows || rows.length === 0) {
      const site = await getSiteConfig();
      if (site.default_rewards_config_id) {
        rows = (await sql`SELECT * FROM rewards_config WHERE id = ${site.default_rewards_config_id} LIMIT 1`) as any;
      }
    }
    if (!rows || rows.length === 0) {
      rows = (await sql`SELECT * FROM rewards_config ORDER BY id DESC LIMIT 1`) as any;
    }
    if (rows && rows.length > 0) {
      const r = rows[0];
      let config = DEFAULT_REWARDS_CONFIG;
      try {
        config = typeof r.config === "string" ? JSON.parse(r.config) : (r.config || DEFAULT_REWARDS_CONFIG);
      } catch {
        // keep default
      }
      const value: RewardsConfig = { id: r.id, name: r.name, is_active: r.is_active, config };
      cache["rewards"] = { value, expiresAt: Date.now() + TTL_MS };
      return value;
    }
  } catch (err) {
    console.error("[config] getRewardsConfig non-fatal:", err);
  }
  const fallback: RewardsConfig = { id: 0, name: "Default rewards (fallback)", is_active: true, config: DEFAULT_REWARDS_CONFIG };
  cache["rewards"] = { value: fallback, expiresAt: Date.now() + TTL_MS };
  return fallback;
}

/** Convenience: a single number for a reward rule key (falls back to default). */
export async function getRewardValue(key: string): Promise<number> {
  const cfg = await getRewardsConfig();
  const v = (cfg.config as Record<string, unknown>)[key];
  return typeof v === "number" ? v : (DEFAULT_REWARDS_CONFIG as Record<string, number>)[key] ?? 0;
}
