/**
 * Fallback Authentication System
 * --------------------------------
 * Provides email/password authentication when Clerk is not configured.
 * Uses JWT tokens stored in HTTP-only cookies.
 * Users are stored in the `users` table (auto-created by db.ts).
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-dev-secret-change-in-production";
const COOKIE_NAME = "9jatruth_auth";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface FallbackUser {
  id: number;
  email: string;
  displayName: string;
  userHash: string;
}

export interface AuthToken {
  userId: number;
  email: string;
  displayName: string;
  userHash: string;
  exp: number;
}

/** Hash a password using bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Verify a password against a bcrypt hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Create a signed JWT token */
function createToken(user: FallbackUser): string {
  const payload: AuthToken = {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    userHash: user.userHash,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Verify and decode a JWT token. Returns null if invalid or expired. */
export function verifyToken(token: string): AuthToken | null {
  try {
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;

    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
    if (sig !== expectedSig) return null;

    const payload: AuthToken = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (payload.exp < Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

/** Get the auth cookie name */
export function getAuthCookieName(): string {
  return COOKIE_NAME;
}

/** Get cookie options for the auth token */
export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TOKEN_TTL_MS / 1000,
  };
}

/** Register a new user with email and password */
export async function registerUser(email: string, password: string, displayName: string): Promise<{ user: FallbackUser; token: string } | { error: string }> {
  const sql = getDb();

  // Check if user already exists
  const existing = (await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`) as unknown as any[];
  if (existing.length > 0) {
    return { error: "An account with this email already exists" };
  }

  const passwordHash = await hashPassword(password);
  const userHash = `dev_${crypto.createHash("sha256").update(email).digest("hex").substring(0, 12)}`;

  const rows = (await sql`
    INSERT INTO users (email, password_hash, display_name, user_hash)
    VALUES (${email}, ${passwordHash}, ${displayName}, ${userHash})
    RETURNING id, email, display_name, user_hash
  `) as unknown as any[];

  const row = rows[0];
  const user: FallbackUser = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    userHash: row.user_hash,
  };

  const token = createToken(user);
  return { user, token };
}

/** Login a user with email and password */
export async function loginUser(email: string, password: string): Promise<{ user: FallbackUser; token: string } | { error: string }> {
  const sql = getDb();

  const rows = (await sql`
    SELECT id, email, password_hash, display_name, user_hash
    FROM users WHERE email = ${email} LIMIT 1
  `) as unknown as any[];

  if (rows.length === 0) {
    return { error: "Invalid email or password" };
  }

  const row = rows[0];
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  const user: FallbackUser = {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    userHash: row.user_hash,
  };

  const token = createToken(user);
  return { user, token };
}

/** Get the auth token from request cookies */
export function getAuthTokenFromRequest(request: Request): AuthToken | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [key, ...val] = c.split("=");
      return [key, val.join("=")];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

/** Get the current user's identity hash from the fallback auth token */
export function getFallbackUserHash(request: Request): string | null {
  const token = getAuthTokenFromRequest(request);
  return token?.userHash ?? null;
}

/** Get the current user from the fallback auth token */
export function getFallbackUser(request: Request): AuthToken | null {
  return getAuthTokenFromRequest(request);
}

/** Check if fallback auth is enabled (when Clerk is not configured) */
export function isFallbackAuthEnabled(): boolean {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
  return !isClerkConfigured;
}
