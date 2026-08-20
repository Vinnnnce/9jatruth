import { ensureDbInitialized, getDb } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { validate, validationErrorResponse } from "@/lib/api-helpers";
import { z } from "zod";

const waitlistSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().trim().max(100).optional(),
  source: z.string().trim().max(50).default("countdown"),
});

/** True when Clerk is actually configured (not a placeholder key). */
function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secret = process.env.CLERK_SECRET_KEY;
  const hasPub = key && !key.includes("placeholder") && key.length > 20;
  const hasSecret = secret && !secret.includes("replace") && secret.length > 20;
  return Boolean(hasPub && hasSecret);
}

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const rateLimitResponse = rateLimit(`waitlist:${ip}`, 5, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ message: "Invalid JSON body" }, { status: 400 });

  const parsed = validate(waitlistSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { email, name, source } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  // ─── 1. Store in Neon database ───────────────────────────────
  let dbStored = false;
  let alreadyOnWaitlist = false;
  let dbError: string | null = null;

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
        clerk_status TEXT DEFAULT 'pending',
        clerk_entry_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    // Self-heal: add columns missing from older schemas (CREATE IF NOT EXISTS
    // won't alter an existing table, so these ALTERs guarantee the columns exist).
    await sql`ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS clerk_status TEXT DEFAULT 'pending'`;
    await sql`ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS clerk_entry_id TEXT`;
    await sql`ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

    // Insert or update — detect whether the email already exists so we can
    // return a friendly message instead of a generic failure.
    const inserted = await sql`
      INSERT INTO waitlist (email, name, source, ip_hash, clerk_status)
      VALUES (${emailLower}, ${name || null}, ${source}, ${ip}, 'pending')
      ON CONFLICT (email)
      DO UPDATE
        SET source = EXCLUDED.source,
            updated_at = NOW()
      RETURNING (xmax = 0) AS inserted
    `;
    const row = (inserted as unknown as Array<{ inserted: boolean }>)[0];
    dbStored = true;
    alreadyOnWaitlist = !(row?.inserted);
  } catch (err: any) {
    dbError = err?.message || "Unknown database error";
    console.error("[Waitlist] DB error:", dbError);
    // Don't return early — try Clerk storage even if DB fails
  }

  // ─── 2. Create Clerk waitlist entry (optional) ─────────────────
  // Clerk waitlist is a convenience layer. If Clerk is not configured or the
  // backend SDK rejects the call, the user is still successfully waitlisted in
  // the Neon database — we never surface a hard failure for that reason alone.
  let clerkStored = false;
  let clerkSkipped = false;

  if (isClerkConfigured()) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const entry = await client.waitlistEntries.create({
        emailAddress: emailLower,
        notify: true,
      });

      clerkStored = true;

      if (dbStored) {
        try {
          const sql = getDb();
          await sql`
            UPDATE waitlist
            SET clerk_status = 'waitlisted', clerk_entry_id = ${entry.id}
            WHERE email = ${emailLower}
          `;
        } catch (dbErr) {
          console.error("[Waitlist] Failed to update clerk_entry_id:", dbErr);
        }
      }
    } catch (err: any) {
      const clerkError: string = err?.message || "Unknown Clerk error";
      // If the entry already exists, that's fine — not an error.
      if (clerkError.includes("already") || clerkError.includes("exists")) {
        clerkStored = true;
      } else {
        console.error("[Waitlist] Clerk error (non-fatal):", clerkError);
        clerkSkipped = true;
      }
    }
  } else {
    clerkSkipped = true;
  }

  // ─── 3. Return response ───────────────────────────────────────
  // The database is the source of truth. As long as the user is stored in
  // Neon, the waitlist signup succeeded — Clerk is best-effort only.
  if (dbStored) {
    if (alreadyOnWaitlist) {
      return Response.json({
        success: true,
        message: "You're already on the waitlist — we'll be in touch soon.",
        alreadyRegistered: true,
        storage: { database: true, clerk: clerkStored },
      });
    }
    return Response.json({
      success: true,
      message: "You're on the waitlist! We'll notify you at launch.",
      storage: { database: true, clerk: clerkStored, clerkSkipped },
    });
  }

  // DB failed entirely — fall back to Clerk-only if that succeeded.
  if (clerkStored) {
    return Response.json({
      success: true,
      message: "You're on the waitlist! We'll notify you at launch.",
      storage: { database: false, clerk: true },
    });
  }

  // Both failed — generic, safe error message (no internal details leaked).
  return Response.json(
    {
      success: false,
      message:
        "We couldn't add you to the waitlist right now. Please try again in a moment.",
    },
    { status: 503 }
  );
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
