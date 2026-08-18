import { ensureDbInitialized, getDb } from "@/lib/db";
import { upsertPlatformUser } from "@/lib/neon-storage";
import { Webhook } from "svix";

/**
 * Clerk webhook endpoint.
 *
 * Verifies the incoming webhook signature using svix, then:
 * 1. Upserts the user into platform_users table (user.created, user.updated)
 * 2. On user.created, matches the email against the waitlist table and
 *    marks the row as 'converted', linking the Clerk user ID.
 *
 * Required env: CLERK_WEBHOOK_SECRET (the Signing Secret from the Clerk dashboard).
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return Response.json({ message: "CLERK_WEBHOOK_SECRET is not configured" }, { status: 500 });
  }

  // svix signature headers
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return Response.json({ message: "Missing svix signature headers" }, { status: 400 });
  }

  const payload = await request.text();

  // Verify the webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;
  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    return Response.json(
      { message: "Invalid webhook signature", error: err instanceof Error ? err.message : "Unknown error" },
      { status: 400 }
    );
  }

  const eventType: string = evt.type;
  const data: any = evt.data;

  // Sync on user creation, update, or deletion events.
  const syncEvents = new Set([
    "user.created",
    "user.updated",
    "user.deleted",
  ]);

  if (!syncEvents.has(eventType)) {
    return Response.json({ received: true, ignored: eventType });
  }

  const clerkUserId: string = data.id;
  if (!clerkUserId) {
    return Response.json({ message: "No user id in payload" }, { status: 400 });
  }

  // On deletion, leave the row (soft handling)
  if (eventType === "user.deleted") {
    // Mark user as deleted in platform_users (soft delete)
    try {
      const sql = getDb();
      await sql`
        UPDATE platform_users 
        SET updated_at = NOW(), deleted_at = NOW()
        WHERE clerk_user_id = ${clerkUserId}
      `;
    } catch {
      // Non-critical — the row stays as-is
    }
    return Response.json({ received: true, event: eventType, deleted: true });
  }

  const email =
    data.email_addresses?.find(
      (e: any) => e.id === data.primary_email_address_id
    )?.email_address ||
    data.email_addresses?.[0]?.email_address ||
    "";

  const firstName = data.first_name || "";
  const lastName = data.last_name || "";
  const displayName = (firstName || lastName ? `${firstName} ${lastName}`.trim() : data.username) || null;
  const avatarUrl = data.image_url || null;

  // ─── 1. Upsert into platform_users ────────────────────────────
  const saved = await upsertPlatformUser({
    clerkUserId,
    email: email || clerkUserId,
    displayName,
    avatarUrl,
  });

  // ─── 2. On user.created, match waitlist emails ───────────────
  // When a new user is created in Clerk (e.g. someone from the waitlist
  // signs up), find their email in the waitlist table and mark it as
  // 'converted', linking the Clerk user ID.
  if (eventType === "user.created" && email) {
    try {
      const sql = getDb();
      const emailLower = email.toLowerCase();
      await sql`
        UPDATE waitlist 
        SET clerk_status = 'converted', 
            clerk_entry_id = ${clerkUserId},
            updated_at = NOW()
        WHERE email = ${emailLower} AND clerk_status != 'converted'
      `;
    } catch (err) {
      console.error("[Clerk Webhook] Failed to update waitlist:", err);
    }
  }

  return Response.json({ received: true, event: eventType, userId: saved?.id ?? null });
}
