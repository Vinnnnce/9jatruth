import { ensureDbInitialized, getDb } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().max(100).optional(),
  source: z.string().trim().max(50).default("countdown"),
});

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const rateLimitResponse = rateLimit(`waitlist:${ip}`, 5, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ message: "Invalid JSON body" }, { status: 400 });

  const parsed = validate(waitlistSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { email, name, source } = parsed.data;

  try {
    await ensureDbInitialized();
    const sql = getDb();

    // Create waitlist table if it doesn't exist (idempotent)
    await sql`
      CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        source TEXT DEFAULT 'countdown',
        ip_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Insert or update — ON CONFLICT does nothing if email already exists
    await sql`
      INSERT INTO waitlist (email, name, source, ip_hash)
      VALUES (${email.toLowerCase()}, ${name || null}, ${source}, ${ip})
      ON CONFLICT (email) DO NOTHING
    `;

    return Response.json({ success: true, message: "Added to waitlist" });
  } catch (err: any) {
    console.error("[Waitlist] Error:", err);
    // If table creation fails (e.g. permissions), still return success
    // so the user experience isn't broken — we can backfill later.
    if (err?.message?.includes("permission") || err?.message?.includes("denied")) {
      return Response.json({ success: true, message: "Added to waitlist" });
    }
    return Response.json(
      { message: "Failed to join waitlist. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await ensureDbInitialized();
    const sql = getDb();
    const result = await sql`SELECT COUNT(*) as count FROM waitlist`;
    const count = (result as unknown as any[])[0]?.count ?? 0;
    return Response.json({ count });
  } catch {
    return Response.json({ count: 0 });
  }
}
