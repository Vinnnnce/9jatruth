import { ensureDbInitialized } from "@/lib/db";
import { upsertPlatformUser } from "@/lib/neon-storage";
import { Webhook } from "svix";

/**
 * Clerk webhook endpoint.
 *
 * Verifies the incoming webhook signature using svix, then upserts the user
 * into the platform_users table on user.created and user.updated events.
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

  // Sync on user creation, update, or deletion-recovery events.
  const syncEvents = new Set([
    "user.created",
    "user.updated",
    "user.deleted", // handled below
  ]);

  if (!syncEvents.has(eventType)) {
    return Response.json({ received: true, ignored: eventType });
  }

  const clerkUserId: string = data.id;
  if (!clerkUserId) {
    return Response.json({ message: "No user id in payload" }, { status: 400 });
  }

  // On deletion, we leave the row (soft handling) — a production system
  // might mark the user inactive. Here we simply acknowledge.
  if (eventType === "user.deleted") {
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

  const saved = await upsertPlatformUser({
    clerkUserId,
    email: email || clerkUserId,
    displayName,
    avatarUrl,
  });

  return Response.json({ received: true, event: eventType, userId: saved?.id ?? null });
}
