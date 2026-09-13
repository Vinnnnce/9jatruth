-- ═══════════════════════════════════════════════════════════════
-- 9JATRUTH — Database Migration & Schema Upgrade Script
-- Target: Neon PostgreSQL
-- Date: 2026-09-13
-- 
-- This script adds:
--   1. Audit log table
--   2. User status fields (status, suspended_until, deleted_at)
--   3. Organization verification_status column
--   4. News external table (if not exists)
--   5. Political data table improvements
--   6. Compare feature indexes
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. AUDIT LOG TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id              SERIAL PRIMARY KEY,
  admin_clerk_id  TEXT NOT NULL,
  action          VARCHAR(60) NOT NULL,
  target_type     VARCHAR(30) NOT NULL,
  target_id       INTEGER,
  target_email    TEXT,
  reason          TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON audit_log(admin_clerk_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ─── 2. USER STATUS FIELDS ──────────────────────────────────────
-- Add status column to platform_users (if not exists)
ALTER TABLE platform_users 
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add CHECK constraint for valid statuses
DO $$ BEGIN
  ALTER TABLE platform_users 
    ADD CONSTRAINT chk_user_status 
    CHECK (status IN ('active', 'blocked', 'suspended', 'deleted'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_platform_users_status ON platform_users(status);

-- ─── 3. ORGANIZATION VERIFICATION STATUS ────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_badge VARCHAR(60),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by TEXT,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT chk_org_verification_status
    CHECK (verification_status IN ('pending', 'accepted', 'declined'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update existing organizations: if verified=1, set verification_status='accepted'
UPDATE organizations SET verification_status = 'accepted' WHERE verified = 1 AND verification_status = 'pending';
UPDATE organizations SET verification_status = 'declined' WHERE verified = 0 AND verification_notes IS NOT NULL AND verification_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_organizations_verification ON organizations(verification_status);

-- ─── 4. NEWS EXTERNAL TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS news_external (
  id            SERIAL PRIMARY KEY,
  source_name   TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  url           TEXT NOT NULL UNIQUE,
  image_url     TEXT,
  published_at  TIMESTAMPTZ,
  category      VARCHAR(50),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_external_published ON news_external(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_external_category ON news_external(category);
CREATE INDEX IF NOT EXISTS idx_news_external_url ON news_external(url);

-- ─── 5. POLITICAL DATA IMPROVEMENTS ─────────────────────────────
-- Ensure political_persons table has AI summary column
ALTER TABLE political_persons 
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS manifesto_summary TEXT;

-- Ensure political_candidates table has needed columns
ALTER TABLE political_candidates
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS manifesto_summary TEXT;

-- ─── 6. COMPARE FEATURE INDEXES ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_political_candidates_party ON political_candidates(party_acronym);
CREATE INDEX IF NOT EXISTS idx_office_holders_party ON office_holders(party_acronym);
CREATE INDEX IF NOT EXISTS idx_office_holders_status ON office_holders(status);

-- ─── 7. FEED/MEDIA IMPROVEMENTS ─────────────────────────────────
-- Ensure micro_truths supports audio media type
-- (media_urls is JSONB array, no schema change needed — just ensure column exists)
ALTER TABLE micro_truths 
  ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- ─── 8. SCHEMA VERSION UPDATE ───────────────────────────────────
-- Update the schema version to reflect these changes
UPDATE schema_versions 
  SET version = '2026-09-13-v12' 
  WHERE version = '2026-09-13-v11';

INSERT INTO schema_versions (version, applied_at)
  VALUES ('2026-09-13-v12', NOW())
  ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- END OF MIGRATION SCRIPT
-- ═══════════════════════════════════════════════════════════════
