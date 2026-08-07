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
    model_version TEXT NOT NULL DEFAULT 'crl-heuristic-v1',
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
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`;
  await sql`ALTER TABLE agency_accounts ADD COLUMN IF NOT EXISTS clerk_user_id TEXT`;

  // Seed reference data (neighborhoods only — no demo posts)
  const existing = await sql`SELECT COUNT(*) as count FROM neighborhoods`;
  if ((existing as any)[0].count === 0) {
    const neighborhoods = [
      { name: "Lekki Phase 1", region: "Lagos", geoHash: "s6z1x4", lat: 6.4474, lng: 3.4735 },
      { name: "Yaba", region: "Lagos", geoHash: "s6z1k3", lat: 6.5244, lng: 3.3792 },
      { name: "Ikeja GRA", region: "Lagos", geoHash: "s6z1g2", lat: 6.5833, lng: 3.3436 },
      { name: "Wuse 2", region: "Abuja", geoHash: "s1z0c4", lat: 9.082, lng: 7.475 },
      { name: "Garki", region: "Abuja", geoHash: "s1z0c3", lat: 9.0338, lng: 7.4884 },
      { name: "New Haven", region: "Enugu", geoHash: "s1z2z3", lat: 6.454, lng: 7.5438 },
      { name: "Dline", region: "Port Harcourt", geoHash: "s1z3x2", lat: 4.8156, lng: 7.0498 },
      { name: "Bodija", region: "Ibadan", geoHash: "s1z1k4", lat: 7.43, lng: 3.91 },
    ];
    for (const n of neighborhoods) {
      await sql`INSERT INTO neighborhoods (name, region, geo_hash, lat, lng) VALUES (${n.name}, ${n.region}, ${n.geoHash}, ${n.lat}, ${n.lng})`;
    }
    console.log("[Soke] Reference data initialized (neighborhoods only, no demo posts)");
  }

  initialized = true;
}
