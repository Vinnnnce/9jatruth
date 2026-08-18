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
  const emailLower = email.toLowerCase();

  let dbStored = false;
  let clerkStored = false;
  let clerkError: string | null = null;

  // ─── 1. Store in Neon database ───────────────────────────────
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
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Insert or update — ON CONFLICT does nothing if email already exists
    await sql`
      INSERT INTO waitlist (email, name, source, ip_hash, clerk_status)
      VALUES (${emailLower}, ${name || null}, ${source}, ${ip}, 'pending')
      ON CONFLICT (email) DO NOTHING
    `;

    dbStored = true;
  } catch (err: any) {
    console.error("[Waitlist] DB error:", err);
    // Don't return early — try Clerk storage even if DB fails
  }

  // ─── 2. Create Clerk waitlist entry ───────────────────────────
  // Uses Clerk's Backend SDK to add the email to the Clerk waitlist.
  // When the user later signs up via Clerk, the webhook will match the
  // waitlist email and update the DB row's clerk_status to 'converted'.
  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const entry = await client.waitlistEntries.create({
      emailAddress: emailLower,
      notify: true,
    });

    clerkStored = true;

    // Update the DB row with the Clerk entry ID if DB storage succeeded
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
    clerkError = err?.message || "Unknown Clerk error";
    console.error("[Waitlist] Clerk error:", clerkError);

    // If Clerk fails because the entry already exists, that's fine
    if (clerkError && (clerkError.includes("already") || clerkError.includes("exists"))) {
      clerkStored = true;
      clerkError = null;
    }
  }

  // ─── 3. Return response ───────────────────────────────────────
  if (dbStored && clerkStored) {
    return Response.json({
      success: true,
      message: "Added to waitlist",
      storage: { database: true, clerk: true },
    });
  } else if (dbStored) {
    return Response.json({
      success: true,
      message: "Added to waitlist",
      storage: { database: true, clerk: false, clerkError: clerkError || undefined },
    });
  } else if (clerkStored) {
    return Response.json({
      success: true,
      message: "Added to waitlist",
      storage: { database: false, clerk: true },
    });
  } else {
    return Response.json(
      { message: "Failed to join waitlist. Please try again.", clerkError: clerkError || undefined },
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
