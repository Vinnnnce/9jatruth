import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Sync Queue (offline-first mesh sync) ───
export const syncQueue = sqliteTable("sync_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceHash: text("device_hash").notNull(),
  operation: text("operation").notNull(), // truth_create | verify | redeem
  payload: text("payload").notNull(), // JSON-serialized request body
  status: text("status").notNull().default("pending"), // pending | synced | conflict | failed
  conflictResolution: text("conflict_resolution"),
  bundleId: text("bundle_id"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  syncedAt: text("synced_at"),
});

// ─── Mesh Events (sync receipts / audit trail) ───
export const meshEvents = sqliteTable("mesh_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bundleId: text("bundle_id").notNull(),
  deviceHash: text("device_hash").notNull(),
  event: text("event").notNull(), // sync_push | sync_pull | conflict | merge
  recordCount: integer("record_count").notNull().default(0),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Push Subscriptions ───
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceHash: text("device_hash").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  categories: text("categories").notNull().default("[]"), // JSON array of subscribed categories
  neighborhoods: text("neighborhoods").notNull().default("[]"), // JSON array of neighborhood IDs
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Achievements (gamification) ───
export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceHash: text("device_hash").notNull(),
  achievement: text("achievement").notNull(), // first_report | streak_7 | verified_50 | etc.
  tier: text("tier").notNull().default("bronze"), // bronze | silver | gold | platinum
  xpAwarded: integer("xp_awarded").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── User Stats (gamification XP/streaks) ───
export const userStats = sqliteTable("user_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceHash: text("device_hash").notNull().unique(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastReportDate: text("last_report_date"),
  totalReports: integer("total_reports").notNull().default(0),
  totalVerifications: integer("total_verifications").notNull().default(0),
  badges: text("badges").notNull().default("[]"), // JSON array
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// ─── Geo Clusters ───
export const geoClusters = sqliteTable("geo_clusters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  geoHash: text("geo_hash").notNull(),
  neighborhoodId: integer("neighborhood_id"),
  clusterType: text("cluster_type").notNull(), // power | fuel | traffic | prices | safety
  reportCount: integer("report_count").notNull().default(0),
  avgTrustScore: integer("avg_trust_score").notNull().default(50),
  centroidLat: real("centroid_lat").notNull(),
  centroidLng: real("centroid_lng").notNull(),
  radiusMeters: integer("radius_meters").notNull().default(500),
  lastReportAt: text("last_report_at").notNull().default(new Date().toISOString()),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Model Runs (AI model execution tracking) ───
export const modelRuns = sqliteTable("model_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelName: text("model_name").notNull(),
  modelVersion: text("model_version").notNull(),
  inputType: text("input_type").notNull(), // truth | neighborhood | batch
  inputId: integer("input_id"),
  output: text("output").notNull().default("{}"), // JSON result
  confidence: real("confidence").notNull().default(0.5),
  explanation: text("explanation"),
  executionMs: integer("execution_ms").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Organizations / Partner Agencies ───
export const organizations = sqliteTable("organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(), // government | utility | media | ngo | community | corporate
  description: text("description"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  website: text("website"),
  logoUrl: text("logo_url"),
  region: text("region"), // Primary operating region
  city: text("city"),
  lat: real("lat"),
  lng: real("lng"),
  verified: integer("verified").notNull().default(0), // 0 = pending, 1 = verified
  active: integer("active").notNull().default(1),
  adminHash: text("admin_hash").notNull(), // Device hash of the org admin
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Agency Accounts (authentication) ───
export const agencyAccounts = sqliteTable("agency_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  organizationId: integer("organization_id").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("admin"), // admin | editor | viewer
  active: integer("active").notNull().default(1),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// ─── Neighborhoods ───
export const neighborhoods = sqliteTable("neighborhoods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  region: text("region").notNull(),
  geoHash: text("geo_hash").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── MicroTruths ───
export const microTruths = sqliteTable("micro_truths", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  neighborhoodId: integer("neighborhood_id").notNull(),
  category: text("category").notNull(), // power | fuel | traffic | prices | safety
  content: text("content").notNull(),
  trustScore: integer("trust_score").notNull().default(50),
  decayFactor: real("decay_factor").notNull().default(1.0),
  verificationChain: text("verification_chain").notNull().default("[]"),
  userHash: text("user_hash").notNull(),
  status: text("status").notNull().default("pending"), // pending | verified | rejected
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  // IP / Location metadata
  ipHash: text("ip_hash"), // SHA-256 hash of client IP (privacy-preserving)
  ipRegion: text("ip_region"), // Derived region from IP
  ipCity: text("ip_city"), // Derived city from IP
  reportLat: real("report_lat"), // Live GPS latitude at submission time
  reportLng: real("report_lng"), // Live GPS longitude at submission time
  locationSource: text("location_source"), // gps | ip | manual
  organizationId: integer("organization_id"), // Partner org that submitted this truth
  // Geo hierarchy fields
  stateName: text("state_name"),
  lgaName: text("lga_name"),
  communityName: text("community_name"),
  villageName: text("village_name"),
  regionName: text("region_name"),
});

// ─── Snapshots ───
export const snapshots = sqliteTable("snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  neighborhoodId: integer("neighborhood_id").notNull(),
  powerStatus: text("power_status").notNull(), // on | off | unstable
  fuelStatus: text("fuel_status").notNull(), // available | scarce | unavailable
  trafficLevel: text("traffic_level").notNull(), // low | moderate | heavy | gridlock
  priceIndex: integer("price_index").notNull().default(100),
  safetyIndex: integer("safety_index").notNull().default(70),
  activeTruths: integer("active_truths").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// ─── Predictions ───
export const predictions = sqliteTable("predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  category: text("category").notNull(), // power | fuel | traffic | prices
  neighborhoodId: integer("neighborhood_id").notNull(),
  prediction: text("prediction").notNull(),
  confidence: integer("confidence").notNull().default(50),
  timeframe: text("timeframe").notNull(),
  trend: text("trend").notNull().default("stable"), // up | down | stable
  modelVersion: text("model_version").notNull().default("soke-heuristic-v1"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Reward Ledger ───
export const rewardLedger = sqliteTable("reward_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userHash: text("user_hash").notNull(),
  amount: integer("amount").notNull(), // +credit / -debit
  type: text("type").notNull(), // submission | verification | redemption
  description: text("description").notNull(),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Verifications ───
export const verifications = sqliteTable("verifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  truthId: integer("truth_id").notNull(),
  userHash: text("user_hash").notNull(),
  action: text("action").notNull(), // corroborate | dispute | stale
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Device Profiles ───
export const deviceProfiles = sqliteTable("device_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceIdHash: text("device_id_hash").notNull().unique(),
  trustScore: integer("trust_score").notNull().default(50),
  totalSubmissions: integer("total_submissions").notNull().default(0),
  rewardsBalance: integer("rewards_balance").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── Insert Schemas ───
export const insertNeighborhoodSchema = createInsertSchema(neighborhoods).omit({
  id: true,
  createdAt: true,
});

export const insertMicroTruthSchema = createInsertSchema(microTruths).omit({
  id: true,
  trustScore: true,
  decayFactor: true,
  verificationChain: true,
  status: true,
  createdAt: true,
  ipHash: true,
  ipRegion: true,
  ipCity: true,
}).extend({
  content: z.string().min(10, "Content must be at least 10 characters").max(500, "Content must not exceed 500 characters"),
  category: z.enum(["power", "fuel", "traffic", "prices", "safety", "security", "real-estate", "housing", "patrol-gas-station", "restaurant", "hotel", "school", "pharmacy", "hospital", "supermarket"]),
  neighborhoodId: z.number().int().positive().max(1000000),
  userHash: z.string().optional(),
  reportLat: z.number().optional(),
  reportLng: z.number().optional(),
  locationSource: z.enum(["gps", "ip", "manual"]).optional(),
  organizationId: z.number().int().positive().optional(),
});

export const insertPredictionSchema = createInsertSchema(predictions).omit({
  id: true,
  createdAt: true,
  modelVersion: true,
});

export const insertRewardSchema = createInsertSchema(rewardLedger).omit({
  id: true,
  createdAt: true,
});

// ─── Types ───
export type Neighborhood = typeof neighborhoods.$inferSelect;
export type MicroTruth = typeof microTruths.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
export type RewardLedger = typeof rewardLedger.$inferSelect;
export type DeviceProfile = typeof deviceProfiles.$inferSelect;

export type InsertNeighborhood = z.infer<typeof insertNeighborhoodSchema>;
export type InsertMicroTruth = z.infer<typeof insertMicroTruthSchema>;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type InsertReward = z.infer<typeof insertRewardSchema>;

// ─── Verification Types ───
export type Verification = typeof verifications.$inferSelect;
export type VerificationAction = "corroborate" | "dispute" | "stale";

// ─── Truth Categories ───
export const TRUTH_CATEGORIES = [
  "power", "fuel", "traffic", "prices", "safety",
  "security", "real-estate", "housing", "patrol-gas-station",
  "restaurant", "hotel", "school", "pharmacy", "hospital", "supermarket",
] as const;
export type TruthCategory = typeof TRUTH_CATEGORIES[number];

// ─── Category Metadata ───
export const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  power: { label: "Power", icon: "Zap" },
  fuel: { label: "Fuel", icon: "Fuel" },
  traffic: { label: "Traffic", icon: "Car" },
  prices: { label: "Prices", icon: "Tag" },
  safety: { label: "Safety", icon: "Shield" },
  security: { label: "Security", icon: "ShieldCheck" },
  "real-estate": { label: "Real Estate", icon: "Building2" },
  housing: { label: "Housing", icon: "Home" },
  "patrol-gas-station": { label: "Patrol/Gas Station", icon: "Fuel" },
  restaurant: { label: "Restaurant", icon: "UtensilsCrossed" },
  hotel: { label: "Hotel", icon: "BedDouble" },
  school: { label: "School", icon: "GraduationCap" },
  pharmacy: { label: "Pharmacy", icon: "Pill" },
  hospital: { label: "Hospital", icon: "Cross" },
  supermarket: { label: "Supermarket", icon: "ShoppingCart" },
};

// ─── Geo Hierarchy ───
export const GEO_LEVELS = ["community", "village", "lga", "state", "region"] as const;
export type GeoLevel = typeof GEO_LEVELS[number];

// ─── Sync Queue Types ───
export const insertSyncQueueSchema = createInsertSchema(syncQueue).omit({
  id: true,
  createdAt: true,
  syncedAt: true,
});

// ─── Push Subscription Types ───
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

// ─── Achievement Types ───
export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});

// ─── User Stats Types ───
export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  updatedAt: true,
});

// ─── Geo Cluster Types ───
export const insertGeoClusterSchema = createInsertSchema(geoClusters).omit({
  id: true,
  createdAt: true,
});

// ─── Model Run Types ───
export const insertModelRunSchema = createInsertSchema(modelRuns).omit({
  id: true,
  createdAt: true,
});

// ─── New Types ───
export type SyncQueueEntry = typeof syncQueue.$inferSelect;
export type MeshEvent = typeof meshEvents.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type Achievement = typeof achievements.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type GeoCluster = typeof geoClusters.$inferSelect;
export type ModelRun = typeof modelRuns.$inferSelect;

export type InsertSyncQueue = z.infer<typeof insertSyncQueueSchema>;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;
export type InsertGeoCluster = z.infer<typeof insertGeoClusterSchema>;
export type InsertModelRun = z.infer<typeof insertModelRunSchema>;

// ─── Gamification Constants ───
export const XP_PER_SUBMISSION = 50;
export const XP_PER_VERIFICATION = 25;
export const XP_PER_CORROBORATION = 15;
export const XP_STREAK_BONUS = 100;
export const LEVEL_BASE_XP = 500;
export const LEVEL_MULTIPLIER = 1.5;

export const ACHIEVEMENT_DEFS = [
  { id: "first_report", name: "First Report", description: "Submitted your first truth report", xp: 50, tier: "bronze" },
  { id: "streak_7", name: "7-Day Streak", description: "Reported truth for 7 consecutive days", xp: 200, tier: "silver" },
  { id: "streak_30", name: "30-Day Streak", description: "Reported truth for 30 consecutive days", xp: 500, tier: "gold" },
  { id: "verified_10", name: "Trusted Voice", description: "Got 10 truths verified by community", xp: 150, tier: "silver" },
  { id: "verified_50", name: "Community Pillar", description: "Got 50 truths verified by community", xp: 500, tier: "gold" },
  { id: "verifier_50", name: "Truth Guardian", description: "Verified 50 community reports", xp: 300, tier: "gold" },
  { id: "rewards_1000", name: "Earner", description: "Earned 1000 reward credits", xp: 200, tier: "silver" },
  { id: "all_categories", name: "Renaissance Reporter", description: "Reported in all 5 categories", xp: 250, tier: "gold" },
  { id: "early_bird", name: "Early Bird", description: "First to report an incident", xp: 100, tier: "silver" },
  { id: "neighborhood_hero", name: "Neighborhood Hero", description: "Top reporter in your area for a week", xp: 400, tier: "platinum" },
] as const;

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  verified: true,
  active: true,
  adminHash: true,
}).extend({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  type: z.enum(["government", "utility", "media", "ngo", "community", "corporate"]),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// ─── Agency Account Types ───
export type AgencyAccount = typeof agencyAccounts.$inferSelect;

export const agencyRegisterSchema = z.object({
  // Organization fields
  orgName: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  orgType: z.enum(["government", "utility", "media", "ngo", "community", "corporate"]),
  description: z.string().max(500).optional(),
  contactEmail: z.string().email("Invalid email address"),
  contactPhone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  region: z.string().optional(),
  city: z.string().optional(),
  // Account fields
  email: z.string().email("Invalid account email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(50),
});

export const agencyLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const agencyUpdateSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")).optional(),
  description: z.string().max(500).optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).max(100).optional(),
});

export type AgencyRegister = z.infer<typeof agencyRegisterSchema>;
export type AgencyLogin = z.infer<typeof agencyLoginSchema>;
export type AgencyUpdate = z.infer<typeof agencyUpdateSchema>;

// ─── Search Result Types ───
export type SearchResult = {
  type: "truth" | "neighborhood" | "prediction" | "alert";
  id: number | string;
  title: string;
  description: string;
  category?: string;
  region?: string;
  trustScore?: number;
  createdAt?: string;
};

// ─── Activity Types ───
export type ActivityEntry = {
  id: string;
  type: "truth_submitted" | "truth_verified" | "reward_earned" | "prediction_made" | "alert_triggered";
  description: string;
  userHash?: string;
  category?: string;
  neighborhood?: string;
  region?: string;
  timestamp: string;
  metadata?: Record<string, any>;
};
