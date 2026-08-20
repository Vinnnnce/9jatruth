# 9jatruth AI Cybersecurity System — Architecture

A complete, zero-trust, AI-powered security layer for the CRL platform.
Protects against human hackers, bots, and AI-generated attacks (deepfakes,
synthetic news, fraud, and coordinated botnets).

## 1. Overview

The security system is built as a set of framework-agnostic modules under
`src/lib/security-engine/` and surfaced through Next.js Route Handlers and
dashboard pages. Every detector is **model-agnostic**: it ships with a
deterministic, explainable baseline and exposes an interface so a trained ML
model or external AI provider can be dropped in without changing callers.

**Standards posture:** OWASP API Security Top-10, NIST Zero-Trust (800-207),
least-privilege RBAC, privacy-preserving IP/device hashing, full audit trail.

```
┌──────────────────────────────────────────────────────────────────┐
│                       Client / Edge                              │
│  (device fingerprint, headers, TOTP 2FA, member session)         │
└───────────────┬──────────────────────────────┬───────────────────┘
                │                              │
        ┌───────▼────────┐          ┌──────────▼──────────┐
        │  middleware.ts │          │  security-middleware │ (withSecurity)
        │  (Clerk auth,  │          │  • IP block check     │
        │   launch gate) │          │  • rate limiting     │
        └────────────────┘          │  • bot detection     │
                                    │  • risk scoring      │
                                    │  • audit logging     │
                                    └──────────┬──────────┘
                                               │
                          ┌────────────────────▼────────────────────┐
                          │      AI Security Engine (pipeline)        │
                          │  injection · behavioral · botnet-graph     │
                          │  reward-fraud · news-NLP · deepfake        │
                          │  mesh-anomaly · telecom-fraud              │
                          └────────────────────┬────────────────────┘
                                               │
                          ┌────────────────────▼────────────────────┐
                          │      Neon PostgreSQL (security tables)    │
                          │  events · devices · members · content ·   │
                          │  fraud · mitigations · alerts · telemetry  │
                          └─────────────────────────────────────────┘
```

## 2. Components

### 2.1 AI Threat Detection Engine (`security-engine/index.ts`)
- `runSecurityPipeline(ctx)` — runs all detectors in parallel and merges
  results into a normalized `SecurityVerdict` (0–1 risk score, severity,
  recommended mitigation action).
- `buildSecurityContext(request)` — extracts IP, hashed IP, device fingerprint,
  and body from a Next.js Request.

### 2.2 Behavioral Anomaly Detection (`behavioral.ts`)
"Autoencoder-style" anomaly model using statistical reconstruction error:
learns a user's request rhythm (inter-arrival time mean/std, hour-of-day
histogram, endpoint entropy) and flags bursts and novel-hour activity.
Interface `BehaviorModel` lets a trained autoencoder replace the baseline.

### 2.3 Graph-Based Botnet Detection (`botnet-graph.ts`)
Models devices as a graph (shared fingerprint / ASN / user-agent / IP edges,
weighted by trust score), then finds connected components above a size
threshold. Returns explainable clusters with shared attributes.

### 2.4 Reward Fraud Detection (`reward-fraud.ts`)
Flags redemption velocity, impossible earning rates, referral farming, and
amount manipulation in the gamification/rewards system.

### 2.5 NLP Fake-News Detection (`nlp-fakenews.ts`)
Lexicon + rule-based authenticity scorer (clickbait, sensationalism,
authority impersonation, unverified sourcing, source-URL quality). Returns a
0–100 authenticity score. `NlpModel` interface accepts a trained classifier.

### 2.6 Deepfake Image/Video Detection (`deepfake.ts`)
Metadata + forensic heuristics: C2PA/Content Credentials presence, editor
fingerprints in EXIF, magic-byte/extension mismatch, implausible dimensions
and framerates. `DeepfakeProvider` interface accepts a hosted Vision model.

### 2.7 Mesh Packet Anomaly Detection (`mesh.ts`)
Protects the offline-first mesh sync: oversized bundles, excessive packet
counts, high duplicate ratios, metadata-flooding patterns.

### 2.8 Telecom API Fraud Protection (`telecom-fraud.ts`)
Guards the airtime/data top-up integration (VTPass / Africa's Talking):
velocity abuse, card-testing, SIM-farm sequential-number patterns.

### 2.9 Zero-Trust Device Fingerprinting (`device.ts`)
Privacy-preserving SHA-256 device fingerprint from request headers + /24 IP
subnet. `isLikelyBot()` detects headless browsers and HTTP libraries from
inconsistent header sets.

### 2.10 RBAC (`rbac.ts`)
Least-privilege roles (Security Analyst, Content Moderator, Fraud Analyst,
Security Manager, Super Admin) with granular deny-by-default permissions. The
super admin email implicitly holds all permissions.

### 2.11 Two-Factor Authentication (`two-factor.ts`)
RFC 6238 TOTP (Google Authenticator / Authy / 1Password compatible) with
backup codes stored bcrypt-hashed and verified by constant-time comparison.

### 2.12 Security Middleware (`security-middleware.ts`)
`withSecurity(handler, options)` wraps any route handler with IP-block checks,
rate limiting, device fingerprint capture, bot detection, RBAC permission
checks, request telemetry, and optional full-pipeline risk scoring.

## 3. Database Schema

All tables are created idempotently in `src/lib/db.ts` →
`ensureDbInitialized()`, so syncing to Neon happens automatically on the first
request after deployment (no manual migration step required).

| Table | Purpose |
|-------|---------|
| `security_events` | Threat log — every verdict, with risk score + signals |
| `device_fingerprints` | Tracked devices, trust scores, bot flags |
| `security_members` | Security team accounts + roles + 2FA secrets |
| `content_verifications` | News/deepfake scoring + moderation verdicts |
| `fraud_signals` | Reward & telecom fraud signals |
| `mitigation_actions` | Active blocks / suspensions / challenges |
| `security_alerts` | High/critical alerts for the monitoring pipeline |
| `security_rules` | Tunable detector thresholds + actions |
| `api_usage_log` | Per-request API telemetry |
| `botnet_clusters` | Computed botnet cluster records |
| `request_telemetry` | Behavioral baseline (24h rolling window) |

## 4. API Endpoints

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/security/analyze` | Public (rate-limited) | Run full pipeline on content |
| GET | `/api/security/me` | Authenticated | Current member's permissions + 2FA state |
| GET | `/api/security/alerts` | CRON_SECRET | Monitoring + alerting sweep |
| GET | `/api/admin/security` | `security.dashboard.view` | Dashboard stats |
| GET/POST | `/api/admin/security/events` | `security.threats.view` | Threat log + acknowledge |
| GET | `/api/admin/security/devices` | `security.devices.view` | Device list |
| GET | `/api/admin/security/botnet` | `security.botnet.view` | Botnet clusters |
| GET/POST | `/api/admin/security/fraud` | `security.fraud.view` | Fraud signals + mitigate |
| GET/POST | `/api/admin/security/content` | `security.content.review` | Content review |
| GET/POST/PATCH | `/api/admin/members` | `security.members.manage` | Member management |
| GET | `/api/admin/roles` | `security.roles.manage` | Role matrix |
| POST | `/api/auth/2fa/setup` | Authenticated | Generate TOTP secret |
| POST | `/api/auth/2fa/verify` | Authenticated | Confirm + enable 2FA |
| POST | `/api/auth/2fa/disable` | Authenticated | Disable 2FA |

## 5. Dashboards

- **Super Admin** (`/admin` → Security tab): full command center — threats,
  devices, botnet, fraud, content, members & roles, plus 2FA oversight.
  Oversees all security activity platform-wide.
- **Member Dashboard** (`/security`): role-scoped view. Members only see the
  modules they have permissions for; the underlying API routes enforce the
  same permissions, so access is denied by default at the data layer too.
  Super admins are redirected to `/admin`.

## 6. Monitoring & Alerting

- A Vercel cron (`/api/security/alerts`) scans for
  unacknowledged high/critical events and creates `security_alerts`.
  On the Hobby plan the cron runs once daily (6:00 UTC); upgrading the
  Vercel project to Pro enables sub-daily (e.g. every 15 min) sweeps.
- The engine auto-creates alerts for any verdict with severity `high` or
  `critical`.
- Mitigation actions (`block_ip`, `suspend_token`, `challenge_2fa`,
  `rate_limit`) are configurable via `security_rules` and default to
  non-destructive modes (log/flag) unless a rule escalates.

## 7. Implementation Steps (reproduce)

1. The security engine libraries live in `src/lib/security-engine/`.
2. DB tables auto-create on first request via `ensureDbInitialized()`.
3. Wrap protected routes with `withSecurity(handler, { requirePermission, rateLimit, runPipeline })`.
4. Add members via the Super Admin → Security → Members tab.
5. Members set up 2FA at `/security`.
6. Deploy to Vercel — `vercel.json` already includes the alerts cron.
7. Set env vars: `DATABASE_URL` (Neon), Clerk keys, `CRON_SECRET`,
   `SUPER_ADMIN_EMAIL`, `KIMI_API_KEY` (optional, for LLM content analysis).

## 8. Plugging in real ML models

The baseline detectors are intentionally explainable and deterministic. To
upgrade to a trained model or hosted AI provider without touching callers:

- **Autoencoder (behavioral):** implement `BehaviorModel` and call
  `scoreWithAutoencoder(model, input)`.
- **NLP classifier (fake news):** implement `NlpModel` and call
  `registerNlpModel(model)`.
- **Deepfake Vision API:** implement `DeepfakeProvider` and call
  `registerDeepfakeProvider(provider)`.

Each pluggable interface keeps the security verdict shape identical, so the
dashboard, audit log, and mitigation pipeline are unaffected by the model swap.

## 9. Waitlist fix

The waitlist endpoint (`/api/waitlist`) previously returned a generic
"Failed to join waitlist" when the Clerk waitlist API errored (e.g. Clerk not
yet configured). It now:
- Treats the Neon database as the source of truth (Clerk is best-effort).
- Returns a friendly "You're already on the waitlist" when an email is a duplicate.
- Never leaks internal Clerk error strings to end users.
- Gracefully degrades when Clerk is unconfigured.
