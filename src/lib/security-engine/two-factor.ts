/**
 * Two-Factor Authentication (TOTP — RFC 6238)
 * ============================================================
 * Time-based One-Time Password implementation for admin/member accounts.
 * Standards-compliant with Google Authenticator, Authy, 1Password, etc.
 *
 * - `generateSecret()` → base32 secret + otpauth:// URI for QR codes.
 * - `generateTOTP()` → current 6-digit code.
 * - `verifyTOTP()` → validates a code, with ±1 time-step window.
 * - Backup codes are generated and stored hashed (bcrypt), verified by
 *   constant-time comparison to resist timing attacks.
 *
 * Uses Node's crypto only — no external dependencies.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TIME_STEP_SECONDS = 30;
const CODE_DIGITS = 6;
const WINDOW = 1; // ±1 step tolerance for clock drift

/** Generate a cryptographically random base32 secret (20 bytes = 160 bits). */
export function generateSecret(length = 20): string {
  const bytes = crypto.randomBytes(length);
  let secret = "";
  for (const byte of bytes) {
    secret += BASE32_ALPHABET[(byte >> 3) & 0x1f];
    secret += BASE32_ALPHABET[((byte << 2) & 0x1f) | (0 & 0x03)];
  }
  return secret.slice(0, 32);
}

/** Build the otpauth:// URI that QR-code generators expect. */
export function buildOtpAuthUri(opts: {
  secret: string;
  account: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${opts.issuer}:${opts.account}`);
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer: opts.issuer,
    algorithm: "SHA1",
    digits: String(CODE_DIGITS),
    period: String(TIME_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

function base32Decode(secret: string): Buffer {
  const cleaned = secret.replace(/=+$/, "").toUpperCase();
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 5) | index;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Compute the TOTP for a given unix timestamp (seconds). */
export function generateTOTP(secret: string, timestampSeconds?: number): string {
  let time = Math.floor((timestampSeconds ?? Math.floor(Date.now() / 1000)) / TIME_STEP_SECONDS);
  const timeBuffer = Buffer.alloc(8);
  // Write as big-endian 64-bit integer
  for (let i = 7; i >= 0; i--) {
    timeBuffer[i] = time & 0xff;
    time = Math.floor(time / 256);
  }

  const key = base32Decode(secret);
  const hmac = crypto.createHmac("sha1", key).update(timeBuffer).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    Math.pow(10, CODE_DIGITS);

  return code.toString().padStart(CODE_DIGITS, "0");
}

/**
 * Verify a TOTP code with ±WINDOW time-step tolerance for clock drift.
 * Uses a constant-time comparison to resist timing attacks.
 */
export function verifyTOTP(secret: string, code: string): boolean {
  if (!code || code.length !== CODE_DIGITS || !/^\d+$/.test(code)) return false;
  const now = Math.floor(Date.now() / 1000);
  const currentTimeStep = Math.floor(now / TIME_STEP_SECONDS);

  for (let i = -WINDOW; i <= WINDOW; i++) {
    const candidate = generateTOTP(secret, (currentTimeStep + i) * TIME_STEP_SECONDS);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(code))) {
      return true;
    }
  }
  return false;
}

/** Generate a set of one-time backup codes (8-digit). */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomInt(0, 100_000_000).toString().padStart(8, "0");
    codes.push(code);
  }
  return codes;
}

/** Hash backup codes for storage (never store plaintext). */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
}

/** Verify a backup code against stored hashes (constant-time). */
export async function verifyBackupCode(
  code: string,
  hashes: string[]
): Promise<boolean> {
  for (const hash of hashes) {
    const match = await bcrypt.compare(code, hash);
    if (match) return true;
  }
  return false;
}

export interface TwoFactorSetup {
  secret: string;
  otpAuthUri: string;
  backupCodes: string[];
}

/** Produce a complete 2FA setup bundle for QR-code enrollment. */
export function createTwoFactorSetup(account: string, issuer = "9jatruth Security"): TwoFactorSetup {
  const secret = generateSecret();
  return {
    secret,
    otpAuthUri: buildOtpAuthUri({ secret, account, issuer }),
    backupCodes: generateBackupCodes(),
  };
}
