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

  try {
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
    model_version TEXT NOT NULL DEFAULT '9jatruth-heuristic-v1',
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

  // Waitlist table for pre-launch email signups
  await sql`CREATE TABLE IF NOT EXISTS waitlist (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    source TEXT DEFAULT 'countdown',
    ip_hash TEXT,
    clerk_status TEXT DEFAULT 'pending',
    clerk_entry_id TEXT,
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
  await sql`ALTER TABLE neighborhoods ADD COLUMN IF NOT EXISTS country TEXT`;

  // Add country column to micro_truths
  await sql`ALTER TABLE micro_truths ADD COLUMN IF NOT EXISTS country TEXT`;

  // ─── Truth Reports table ───
  await sql`CREATE TABLE IF NOT EXISTS truth_reports (
    id SERIAL PRIMARY KEY,
    truth_id INTEGER NOT NULL,
    reporter_user_hash TEXT,
    reason TEXT NOT NULL DEFAULT 'inappropriate',
    details TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_truth_reports_truth ON truth_reports(truth_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_truth_reports_status ON truth_reports(status)`;

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
    console.log("[9jatruth] Geo hierarchy reference data initialized (regions & states)");
  }

  // Seed LGAs for Nigerian states
  const existingLgas = await sql`SELECT COUNT(*) as count FROM lgas`;
  if ((existingLgas as any)[0].count === 0) {
    const lgaData: Record<string, string[]> = {
      Lagos: ["Agege", "Ajeromi-Ifelodun", "Alimosho", "Amuwo-Odofin", "Apapa", "Badagry", "Epe", "Eti-Osa", "Ibeju-Lekki", "Ifako-Ijaiye", "Ikeja", "Ikorodu", "Kosofe", "Lagos Island", "Lagos Mainland", "Mushin", "Ojo", "Oshodi-Isolo", "Shomolu", "Surulere"],
      Ogun: ["Abeokuta North", "Abeokuta South", "Ado-Odo/Ota", "Egbado North", "Egbado South", "Ewekoro", "Ifo", "Ijebu East", "Ijebu North", "Ijebu North East", "Ijebu Ode", "Ikenne", "Imeko-Afon", "Ipokia", "Obafemi-Owode", "Odeda", "Odogbolu", "Remo North", "Shagamu", "Yewa South"],
      Oyo: ["Afijio", "Akinyele", "Atiba", "Atisbo", "Egbeda", "Ibadan North", "Ibadan North East", "Ibadan North West", "Ibadan South East", "Ibadan South West", "Ibarapa Central", "Ibarapa East", "Ibarapa North", "Ido", "Irepo", "Iseyin", "Itesiwaju", "Iwajowa", "Kajola", "Lagelu", "Ogbomoso North", "Ogbomoso South", "Ogo Oluwa", "Olorunsogo", "Oluyole", "Ona Ara", "Orelope", "Ori Ire", "Surulere", "Saki East", "Saki West", "Iseyin"],
      FCT: ["Abaji", "Bwari", "Gwagwalada", "Kuje", "Kwali", "Municipal Area Council"],
      Rivers: ["Abua-Odual", "Ahoada East", "Ahoada West", "Akuku-Toru", "Andoni", "Asari-Toru", "Bonny", "Degema", "Eleme", "Emuoha", "Etche", "Gokana", "Ikwerre", "Khana", "Obio-Akpor", "Ogba-Egbema-Ndoni", "Ogu-Bolo", "Okirika", "Omuma", "Opobo-Nkoro", "Oyigbo", "Port Harcourt", "Tai"],
      Enugu: ["Aninri", "Awgu", "Enugu East", "Enugu North", "Enugu South", "Ezeagu", "Igbo Etiti", "Igbo Eze North", "Igbo Eze South", "Isi Uzo", "Nkanu East", "Nkanu West", "Nsukka", "Oji River", "Udenu", "Udi", "Uzo Uwani"],
      Kano: ["Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala", "Dambatta", "Dawakin Kudu", "Dawakin Tofa", "Doguwa", "Fagge", "Gabasawa", "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Gwarzo", "Kabo", "Kano Municipal", "Karaye", "Kibiya", "Kiru", "Kumbotso", "Kunchi", "Kura", "Madobi", "Makoda", "Minjibir", "Nasarawa", "Rano", "Rimin Gado", "Rogo", "Shanono", "Sumaila", "Takai", "Tarauni", "Tofa", "Tsanyawa", "Tudun Wada", "Ungogo", "Warawa", "Wudil"],
      Kaduna: ["Birnin Gwari", "Chikun", "Giwa", "Igabi", "Ikara", "Jaba", "Jema'a", "Kachia", "Kaduna North", "Kaduna South", "Kagarko", "Kajuru", "Kaura", "Kauru", "Kubau", "Kudan", "Lere", "Makarfi", "Sabon Gari", "Sanga", "Soba", "Zaria"],
    };
    for (const [stateName, lgaNames] of Object.entries(lgaData)) {
      const stateRow = (await sql`SELECT id FROM states WHERE name = ${stateName}`) as any;
      const stateId = stateRow[0]?.id;
      if (stateId) {
        for (const lgaName of lgaNames) {
          await sql`INSERT INTO lgas (name, state_id) VALUES (${lgaName}, ${stateId})`;
        }
      }
    }
    console.log("[9jatruth] LGA reference data initialized");
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
    console.log("[9jatruth] Reference data initialized (neighborhoods with geo hierarchy, no demo posts)");
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
    image_url TEXT,
    sticker_id TEXT,
    gift_id TEXT,
    parent_comment_id INTEGER REFERENCES feed_comments(id) ON DELETE CASCADE,
    like_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
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

  // Add rich comment columns to feed_comments (idempotent)
  await sql`ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS image_url TEXT`;
  await sql`ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS sticker_id TEXT`;
  await sql`ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS gift_id TEXT`;
  await sql`ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE feed_comments ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0`;

  // Feed comment likes table
  await sql`CREATE TABLE IF NOT EXISTS feed_comment_likes (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES feed_comments(id) ON DELETE CASCADE,
    user_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(comment_id, user_hash)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feed_comment_likes_comment ON feed_comment_likes(comment_id)`;

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

  // ─── AI Verifications Table ───
  await sql`CREATE TABLE IF NOT EXISTS ai_verifications (
    id SERIAL PRIMARY KEY,
    truth_id INTEGER NOT NULL UNIQUE,
    verdict TEXT NOT NULL DEFAULT 'unverified',
    confidence INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    explanation TEXT,
    signals JSONB DEFAULT '{}'::jsonb,
    verified_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ai_verifications_truth_id ON ai_verifications(truth_id)`;

  // ─── User Browsing Events (behaviour tracking for AI suggestions) ───
  await sql`CREATE TABLE IF NOT EXISTS user_browsing_events (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT,
    user_hash TEXT,
    event_type TEXT NOT NULL,
    truth_id INTEGER,
    neighborhood_id INTEGER,
    category TEXT,
    path TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    dwell_ms INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_browsing_user ON user_browsing_events(clerk_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_browsing_hash ON user_browsing_events(user_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_browsing_created ON user_browsing_events(created_at)`;

  // ─── Post Suggestions (AI-generated recommendations) ───
  await sql`CREATE TABLE IF NOT EXISTS post_suggestions (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT,
    user_hash TEXT,
    truth_id INTEGER NOT NULL,
    score DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    reason TEXT,
    source_model TEXT NOT NULL DEFAULT 'heuristic',
    clicked INTEGER NOT NULL DEFAULT 0,
    dismissed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_suggestions_user ON post_suggestions(clerk_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_suggestions_hash ON post_suggestions(user_hash)`;

  // ─── Weekly User Reviews (admin dashboard AI summaries) ───
  await sql`CREATE TABLE IF NOT EXISTS weekly_user_reviews (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    clerk_user_id TEXT,
    user_hash TEXT,
    email TEXT,
    display_name TEXT,
    metrics JSONB DEFAULT '{}'::jsonb,
    summary TEXT,
    recommendations JSONB DEFAULT '[]'::jsonb,
    risk_flags JSONB DEFAULT '[]'::jsonb,
    ai_summary TEXT,
    model_version TEXT DEFAULT 'heuristic',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(week_start, clerk_user_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_weekly_review_week ON weekly_user_reviews(week_start)`;

  // ─── Event Time-Series (aggregated historical patterns) ───
  await sql`CREATE TABLE IF NOT EXISTS event_time_series (
    id SERIAL PRIMARY KEY,
    period_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    neighborhood_id INTEGER,
    category TEXT,
    event_count INTEGER NOT NULL DEFAULT 0,
    avg_trust_score INTEGER NOT NULL DEFAULT 50,
    positive_count INTEGER NOT NULL DEFAULT 0,
    negative_count INTEGER NOT NULL DEFAULT 0,
    neutral_count INTEGER NOT NULL DEFAULT 0,
    avg_sentiment_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    top_keywords JSONB DEFAULT '[]'::jsonb,
    trend TEXT NOT NULL DEFAULT 'stable',
    summary TEXT,
    aggregated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_type, period_start, neighborhood_id, category)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_timeseries_period ON event_time_series(period_type, period_start)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_timeseries_neighborhood ON event_time_series(neighborhood_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_timeseries_category ON event_time_series(category)`;

  // ─── Prediction freshness / dedup ───
  await sql`ALTER TABLE predictions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
  await sql`CREATE INDEX IF NOT EXISTS idx_predictions_neighborhood ON predictions(neighborhood_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions(created_at DESC)`;

  // ─── User Feedback ───
  await sql`CREATE TABLE IF NOT EXISTS user_feedback (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT,
    user_hash TEXT,
    email TEXT,
    display_name TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    rating INTEGER DEFAULT 0,
    page_url TEXT,
    user_agent TEXT,
    ip_hash TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    admin_response TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_feedback_created ON user_feedback(created_at DESC)`;

  // ─── Questionnaire Responses ───
  await sql`CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT,
    user_hash TEXT,
    email TEXT,
    display_name TEXT,
    questionnaire_type TEXT NOT NULL DEFAULT 'general',
    responses JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_hash TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_questionnaire_status ON questionnaire_responses(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_questionnaire_created ON questionnaire_responses(created_at DESC)`;

  // ─── NEW: News System Tables ───

  await sql`CREATE TABLE IF NOT EXISTS news_articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    media_urls TEXT NOT NULL DEFAULT '[]',
    category TEXT NOT NULL DEFAULT 'general',
    tags TEXT NOT NULL DEFAULT '[]',
    author_id INTEGER,
    author_name TEXT NOT NULL,
    author_type TEXT NOT NULL DEFAULT 'agency',
    organization_id INTEGER,
    state TEXT,
    lga TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_badge TEXT,
    trust_score INTEGER NOT NULL DEFAULT 50,
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    accuracy_bonus INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_news_status ON news_articles(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_news_org ON news_articles(organization_id)`;

  // Ensure all columns exist (for tables created before all columns were added)
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS accuracy_bonus INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS author_id TEXT`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS verification_badge TEXT`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 50`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS media_urls TEXT NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS cover_image_url TEXT`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '[]'`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS state TEXT`;
  await sql`ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS lga TEXT`;

  await sql`CREATE TABLE IF NOT EXISTS news_comments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL,
    user_hash TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    content TEXT NOT NULL,
    image_url TEXT,
    sticker_id TEXT,
    gift_id TEXT,
    parent_comment_id INTEGER REFERENCES news_comments(id) ON DELETE CASCADE,
    like_count INTEGER NOT NULL DEFAULT 0,
    reply_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_news_comments_article ON news_comments(article_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_news_comments_user ON news_comments(user_hash)`;

  await sql`CREATE TABLE IF NOT EXISTS news_likes (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL,
    user_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(article_id, user_hash)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS comment_likes (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL,
    user_hash TEXT NOT NULL,
    article_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_hash)
  )`;

  // ─── NEW: Rewards System Tables ───

  await sql`CREATE TABLE IF NOT EXISTS reward_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS reward_redemptions (
    id SERIAL PRIMARY KEY,
    user_hash TEXT NOT NULL,
    reward_type TEXT NOT NULL,
    reward_category TEXT NOT NULL,
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    description TEXT NOT NULL,
    recipient_phone TEXT,
    recipient_name TEXT,
    network_provider TEXT,
    gift_card_code TEXT,
    voucher_store_name TEXT,
    voucher_code TEXT,
    admin_notes TEXT,
    processed_by TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  // Ensure all columns exist on reward_redemptions (for tables created before all columns were added)
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS reward_category TEXT`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS recipient_name TEXT`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS network_provider TEXT`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS gift_card_code TEXT`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS voucher_code TEXT`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS voucher_store_name TEXT`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS admin_notes TEXT`;
  await sql`ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS processed_by TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_redemptions_user ON reward_redemptions(user_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_redemptions_status ON reward_redemptions(status)`;

  await sql`CREATE TABLE IF NOT EXISTS gift_cards (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    brand TEXT NOT NULL,
    face_value INTEGER NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NGN',
    expiry_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    redeemed_by TEXT,
    redeemed_at TIMESTAMPTZ,
    created_by TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gift_cards_type ON gift_cards(type)`;

  await sql`CREATE TABLE IF NOT EXISTS store_vouchers (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    store_name TEXT NOT NULL,
    store_type TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    discount_type TEXT NOT NULL DEFAULT 'fixed',
    discount_value INTEGER NOT NULL,
    min_purchase INTEGER NOT NULL DEFAULT 0,
    max_discount INTEGER,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    used_by TEXT,
    used_at TIMESTAMPTZ,
    partner_business TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vouchers_store ON store_vouchers(store_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vouchers_status ON store_vouchers(status)`;

  // ─── NEW: Telecom Transactions Table ───

  await sql`CREATE TABLE IF NOT EXISTS telecom_transactions (
    id SERIAL PRIMARY KEY,
    user_hash TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    network_provider TEXT NOT NULL,
    service_type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    plan_code TEXT,
    plan_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    provider_ref TEXT,
    provider TEXT,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    ledger_entry_id INTEGER,
    redemption_id INTEGER,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_telecom_user ON telecom_transactions(user_hash)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_telecom_status ON telecom_transactions(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_telecom_phone ON telecom_transactions(phone_number)`;

  // ─── NEW: Audit Logs Table ───

  await sql`CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    description TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id)`;

  // ─── NEW: Questionnaire Management Table ───

  await sql`CREATE TABLE IF NOT EXISTS questionnaires (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    questions TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // ─── NEW: Feedback Schedule Table ───

  await sql`CREATE TABLE IF NOT EXISTS feedback_schedules (
    id SERIAL PRIMARY KEY,
    user_hash TEXT NOT NULL UNIQUE,
    clerk_user_id TEXT,
    signup_date TIMESTAMPTZ NOT NULL,
    first_prompt_shown BOOLEAN NOT NULL DEFAULT FALSE,
    first_prompt_date TIMESTAMPTZ,
    last_prompt_date TIMESTAMPTZ,
    next_prompt_date TIMESTAMPTZ,
    feedback_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // ─── NEW: News Accuracy Incentives Table ───

  await sql`CREATE TABLE IF NOT EXISTS news_incentives (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL,
    user_hash TEXT NOT NULL,
    incentive_type TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    badge_name TEXT,
    trust_boost INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_incentives_article ON news_incentives(article_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_incentives_user ON news_incentives(user_hash)`;

  // Polls
  await sql`CREATE TABLE IF NOT EXISTS polls (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'truth' NOT NULL,
    content_id INTEGER,
    created_by VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    total_votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS poll_options (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS poll_votes (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    option_id INTEGER REFERENCES poll_options(id) ON DELETE CASCADE,
    user_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(poll_id, user_hash)
  )`;

  // Scheduled content
  await sql`CREATE TABLE IF NOT EXISTS scheduled_content (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'scheduled',
    created_by VARCHAR(64) NOT NULL,
    published_ref_id INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_content(status, scheduled_at)`;

  // Seed default reward categories
  const existingCats = await sql`SELECT COUNT(*) as count FROM reward_categories`;
  if ((existingCats as any)[0].count === 0) {
    const cats = [
      { name: 'Airtime', description: 'Mobile phone airtime top-up', icon: 'Smartphone' },
      { name: 'Data', description: 'Mobile data bundles', icon: 'Wifi' },
      { name: 'Gift Cards', description: 'Digital gift cards for various brands', icon: 'Gift' },
      { name: 'Shopping Vouchers', description: 'Discount vouchers for stores and markets', icon: 'ShoppingBag' },
      { name: 'Cash', description: 'Cash rewards to bank account', icon: 'Wallet' },
    ];
    for (const c of cats) {
      await sql`INSERT INTO reward_categories (name, description, icon) VALUES (${c.name}, ${c.description}, ${c.icon})`;
    }
  }

  // Emergency contacts table for law enforcement agencies
  await sql`CREATE TABLE IF NOT EXISTS emergency_contacts (
    id SERIAL PRIMARY KEY,
    agency_type TEXT NOT NULL,
    agency_name TEXT NOT NULL,
    phone_primary TEXT,
    phone_secondary TEXT,
    email TEXT,
    address TEXT,
    state TEXT,
    lga TEXT,
    community TEXT,
    village TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    coverage_radius_km INTEGER DEFAULT 50,
    verified BOOLEAN DEFAULT false,
    source TEXT DEFAULT '9jatruth',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emergency_state ON emergency_contacts(state)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emergency_lga ON emergency_contacts(lga)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_emergency_type ON emergency_contacts(agency_type)`;

  } catch (err) {
    console.error('[DB Init] Non-fatal error during initialization (continuing):', err);
  }

  initialized = true;
}
