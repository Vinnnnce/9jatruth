import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

let sqlInstance: NeonQueryFunction<true, true> | null = null;

/**
 * Get the Neon SQL tagged template client.
 * Requires DATABASE_URL to be set.
 */
export function getDb(): NeonQueryFunction<true, true> {
  if (sqlInstance) return sqlInstance as any;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it in .env to your Neon connection string."
    );
  }
  sqlInstance = neon(url) as any;
  return sqlInstance as any;
}


/**
 * Ensure the database is initialized with all tables.
 * Called on first request (idempotent).
 */
let initialized = false;

export async function ensureDbInitialized() {
  if (initialized) return;
  const sql = getDb();

  // Core tables
  await sql`CREATE TABLE IF NOT EXISTS neighborhoods (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    geo_hash TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS micro_truths (
    id SERIAL PRIMARY KEY,
    neighborhood_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    trust_score INTEGER NOT NULL DEFAULT 50,
    decay_factor DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    verification_chain TEXT NOT NULL DEFAULT '[]',
    user_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_hash TEXT,
    ip_region TEXT,
    ip_city TEXT,
    report_lat DOUBLE PRECISION,
    report_lng DOUBLE PRECISION,
    location_source TEXT,
    organization_id INTEGER
  )`;

  await sql`CREATE TABLE IF NOT EXISTS snapshots (
    id SERIAL PRIMARY KEY,
    neighborhood_id INTEGER NOT NULL,
    power_status TEXT NOT NULL,
    fuel_status TEXT NOT NULL,
    traffic_level TEXT NOT NULL,
    price_index INTEGER NOT NULL DEFAULT 100,
    safety_index INTEGER NOT NULL DEFAULT 70,
    active_truths INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    neighborhood_id INTEGER NOT NULL,
    prediction TEXT NOT NULL,
    confidence INTEGER NOT NULL DEFAULT 50,
    timeframe TEXT NOT NULL,
    trend TEXT NOT NULL DEFAULT 'stable',
    model_version TEXT NOT NULL DEFAULT 'soke-heuristic-v1',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS reward_ledger (
    id SERIAL PRIMARY KEY,
    user_hash TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS device_profiles (
    id SERIAL PRIMARY KEY,
    device_id_hash TEXT NOT NULL UNIQUE,
    trust_score INTEGER NOT NULL DEFAULT 50,
    total_submissions INTEGER NOT NULL DEFAULT 0,
    rewards_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS verifications (
    id SERIAL PRIMARY KEY,
    truth_id INTEGER NOT NULL,
    user_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_verifications_truth_user ON verifications(truth_id, user_hash)`;

  await sql`CREATE TABLE IF NOT EXISTS sync_queue (
    id SERIAL PRIMARY KEY,
    device_hash TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    conflict_resolution TEXT,
    bundle_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    synced_at TIMESTAMPTZ
  )`;

  await sql`CREATE TABLE IF NOT EXISTS mesh_events (
    id SERIAL PRIMARY KEY,
    bundle_id TEXT NOT NULL,
    device_hash TEXT NOT NULL,
    event TEXT NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    device_hash TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    categories TEXT NOT NULL DEFAULT '[]',
    neighborhoods TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    device_hash TEXT NOT NULL,
    achievement TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'bronze',
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    device_hash TEXT NOT NULL UNIQUE,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    last_report_date TEXT,
    total_reports INTEGER NOT NULL DEFAULT 0,
    total_verifications INTEGER NOT NULL DEFAULT 0,
    badges TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS geo_clusters (
    id SERIAL PRIMARY KEY,
    geo_hash TEXT NOT NULL,
    neighborhood_id INTEGER,
    cluster_type TEXT NOT NULL,
    report_count INTEGER NOT NULL DEFAULT 0,
    avg_trust_score INTEGER NOT NULL DEFAULT 50,
    centroid_lat DOUBLE PRECISION NOT NULL,
    centroid_lng DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 500,
    last_report_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS model_runs (
    id SERIAL PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    input_type TEXT NOT NULL,
    input_id INTEGER,
    output TEXT NOT NULL DEFAULT '{}',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    explanation TEXT,
    execution_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    website TEXT,
    logo_url TEXT,
    region TEXT,
    city TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    verified INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    admin_hash TEXT NOT NULL,
    clerk_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS agency_accounts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    active INTEGER NOT NULL DEFAULT 1,
    last_login_at TIMESTAMPTZ,
    clerk_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // ─── NEW: RBAC / Members / Vacancies ───

  await sql`CREATE TABLE IF NOT EXISTS org_members (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    clerk_user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    active INTEGER NOT NULL DEFAULT 1,
    invited_by TEXT,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_org_clerk ON org_members(organization_id, clerk_user_id)`;

  await sql`CREATE TABLE IF NOT EXISTS role_definitions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS vacancies (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    location TEXT,
    employment_type TEXT NOT NULL DEFAULT 'full-time',
    salary_range TEXT,
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    responsibilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'open',
    application_deadline TIMESTAMPTZ,
    posted_by_clerk_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS vacancy_applications (
    id SERIAL PRIMARY KEY,
    vacancy_id INTEGER NOT NULL,
    clerk_user_id TEXT,
    applicant_name TEXT NOT NULL,
    applicant_email TEXT NOT NULL,
    cover_letter TEXT,
    resume_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // ─── NEW: Platform Users (Clerk-synced) ───

  await sql`CREATE TABLE IF NOT EXISTS platform_users (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_org_admin BOOLEAN NOT NULL DEFAULT FALSE,
    organization_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // Add columns to existing tables (idempotent)
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS ip_hash TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS ip_region TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS ip_city TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS report_lat DOUBLE PRECISION`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS report_lng DOUBLE PRECISION`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS location_source TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS organization_id INTEGER`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS state_name TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS lga_name TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS community_name TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS village_name TEXT`;
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS region_name TEXT`;
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`;
  await sql`ALTER TABLE agency_accounts ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`;

  // Add geo hierarchy columns to neighborhoods
  await sql`ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS state TEXT`;
  await sql`ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS lga TEXT`;
  await sql`ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS community TEXT`;
  await sql`ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS village TEXT`;

  // Add IP tracking columns to platform_users
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS last_ip_hash TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS last_ip_region TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS last_ip_city TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS state TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS lga TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS community TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS village TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS region TEXT`;

  // ─── Geo Hierarchy Reference Tables ───
  await sql`CREATE TABLE IF NOT EXISTS regions (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS states (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    region_id INTEGER REFERENCES regions(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS lgas (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    state_id INTEGER REFERENCES states(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS villages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    lga_id INTEGER REFERENCES lgas(id),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS communities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    village_id INTEGER REFERENCES villages(id),
    geo_hash TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // Seed geo hierarchy reference data (Nigeria regions/states only — no demo posts)
  const existingRegions = await sql`SELECT COUNT(*) as count FROM regions`;
  if ((existingRegions as any)[0].count === 0) {
    const regions = [
      { name: "North Central" }, { name: "North East" }, { name: "North West" },
      { name: "South East" }, { name: "South South" }, { name: "South West" },
    ];
    for (const r of regions) {
      await sql`INSERT INTO regions (name) VALUES (${r.name})`;
    }

    const states = [
      { name: "Lagos", region: "South West" }, { name: "Ogun", region: "South West" },
      { name: "Oyo", region: "South West" }, { name: "Osun", region: "South West" },
      { name: "Ondo", region: "South West" }, { name: "Ekiti", region: "South West" },
      { name: "Ekiti", region: "South West" },
      { name: "Abia", region: "South East" }, { name: "Anambra", region: "South East" },
      { name: "Ebonyi", region: "South East" }, { name: "Enugu", region: "South East" },
      { name: "Imo", region: "South East" },
      { name: "Akwa Ibom", region: "South South" }, { name: "Bayelsa", region: "South South" },
      { name: "Cross River", region: "South South" }, { name: "Delta", region: "South South" },
      { name: "Edo", region: "South South" }, { name: "Rivers", region: "South South" },
      { name: "Benue", region: "North Central" }, { name: "Kogi", region: "North Central" },
      { name: "Kwara", region: "North Central" }, { name: "Nasarawa", region: "North Central" },
      { name: "Plateau", region: "North Central" }, { name: "FCT", region: "North Central" },
      { name: "Adamawa", region: "North East" }, { name: "Bauchi", region: "North East" },
      { name: "Borno", region: "North East" }, { name: "Gombe", region: "North East" },
      { name: "Taraba", region: "North East" }, { name: "Yobe", region: "North East" },
      { name: "Jigawa", region: "North West" }, { name: "Kaduna", region: "North West" },
      { name: "Kano", region: "North West" }, { name: "Katsina", region: "North West" },
      { name: "Kebbi", region: "North West" }, { name: "Sokoto", region: "North West" },
      { name: "Zamfara", region: "North West" },
    ];
    for (const s of states) {
      const regionRow = (await sql`SELECT id FROM regions WHERE name = ${s.region}`) as any;
      const regionId = regionRow[0]?.id;
      await sql`INSERT INTO states (name, region_id) VALUES (${s.name}, ${regionId})`;
    }
    console.log("[Soke] Geo hierarchy reference data initialized (regions & states)");
  }

  // Seed neighborhoods with geo hierarchy (reference data only — no demo posts)
  const existing = await sql`SELECT COUNT(*) as count FROM neighborhoods`;
  if ((existing as any)[0].count === 0) {
    const neighborhoods = [
      { name: "Lekki Phase 1", region: "Lagos", geoHash: "s6z1x4", lat: 6.4474, lng: 3.4735, state: "Lagos", lga: "Eti-Osa", community: "Lekki Phase 1", village: null },
      { name: "Yaba", region: "Lagos", geoHash: "s6z1k3", lat: 6.5244, lng: 3.3792, state: "Lagos", lga: "Lagos Mainland", community: "Yaba", village: null },
      { name: "Ikeja GRA", region: "Lagos", geoHash: "s6z1g2", lat: 6.5833, lng: 3.3436, state: "Lagos", lga: "Ikeja", community: "Ikeja GRA", village: null },
      { name: "Wuse 2", region: "Abuja", geoHash: "s1z0c4", lat: 9.082, lng: 7.475, state: "FCT", lga: "Municipal Area Council", community: "Wuse 2", village: null },
      { name: "Garki", region: "Abuja", geoHash: "s1z0c3", lat: 9.0338, lng: 7.4884, state: "FCT", lga: "Municipal Area Council", community: "Garki", village: null },
      { name: "New Haven", region: "Enugu", geoHash: "s1z2z3", lat: 6.454, lng: 7.5438, state: "Enugu", lga: "Enugu East", community: "New Haven", village: null },
      { name: "Dline", region: "Port Harcourt", geoHash: "s1z3x2", lat: 4.8156, lng: 7.0498, state: "Rivers", lga: "Port Harcourt", community: "Dline", village: null },
      { name: "Bodija", region: "Ibadan", geoHash: "s1z1k4", lat: 7.43, lng: 3.91, state: "Oyo", lga: "Ibadan North", community: "Bodija", village: null },
    ];
    for (const n of neighborhoods) {
      await sql`INSERT INTO neighborhoods (name, region, geo_hash, lat, lng, state, lga, community, village) VALUES (${n.name}, ${n.region}, ${n.geoHash}, ${n.lat}, ${n.lng}, ${n.state}, ${n.lga}, ${n.community}, ${n.village})`;
    }
    console.log("[Soke] Reference data initialized (neighborhoods with geo hierarchy, no demo posts)");
  }

  // Notifications table
  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_hash TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    read INTEGER NOT NULL DEFAULT 0,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_hash ON notifications(user_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_hash, read)`;

  // Feed interactions: likes
  await sql`CREATE TABLE IF NOT EXISTS feed_likes (
    id SERIAL PRIMARY KEY,
    truth_id INTEGER NOT NULL REFERENCES micro_truths(id) ON DELETE CASCADE,
    user_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(truth_id, user_hash)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_likes_truth ON feed_likes(truth_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_likes_user ON feed_likes(user_hash)`;

  // Feed interactions: comments
  await sql`CREATE TABLE IF NOT EXISTS feed_comments (
    id SERIAL PRIMARY KEY,
    truth_id INTEGER NOT NULL REFERENCES micro_truths(id) ON DELETE CASCADE,
    user_hash TEXT NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id INTEGER REFERENCES feed_comments(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_comments_truth ON feed_comments(truth_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_comments_user ON feed_comments(user_hash)`;

  // Feed interactions: shares
  await sql`CREATE TABLE IF NOT EXISTS feed_shares (
    id SERIAL PRIMARY KEY,
    truth_id INTEGER NOT NULL REFERENCES micro_truths(id) ON DELETE CASCADE,
    user_hash TEXT,
    channel TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_shares_truth ON feed_shares(truth_id)`;

  // User subscriptions
  await sql`CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    subscriber_hash TEXT NOT NULL,
    target_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(subscriber_hash, target_hash)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_subscriber ON user_subscriptions(subscriber_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_target ON user_subscriptions(target_hash)`;

  // Location preferences on platform_users
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferred_neighborhood_id INTEGER`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferred_state_name TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferred_lga_name TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferred_community_name TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferred_region_name TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferred_lat DOUBLE PRECISION`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS preferred_lng DOUBLE PRECISION`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS location_source TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS location_updated_at TIMESTAMPTZ`;

  // Optional profile detail columns
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS bio TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS occupation TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS website TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS twitter_handle TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS linkedin_url TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS date_of_birth DATE`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS gender TEXT`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS interests TEXT[]`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS skills TEXT[]`;
  await sql`ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE`;

  initialized = true;
}
