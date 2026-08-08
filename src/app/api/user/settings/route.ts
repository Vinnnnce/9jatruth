import { ensureDbInitialized, getDb } from "@/lib/db";
import { getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { z } from "zod";

/**
 * GET /api/user/settings
 * Returns the current user's advanced settings.
 */
export async function GET() {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  try {
    const rows = (await sql`
      SELECT
        notification_preferences,
        privacy_settings,
        display_preferences,
        language_preference,
        timezone,
        bio,
        phone,
        occupation,
        website,
        twitter_handle,
        linkedin_url,
        profile_completed
      FROM platform_users
      WHERE clerk_user_id = ${clerkUserId}
    `) as unknown as any[];

    if (!rows[0]) {
      return Response.json({ message: "User not found" }, { status: 404 });
    }

    const r = rows[0];
    return Response.json({
      notificationPreferences: typeof r.notification_preferences === "string"
        ? JSON.parse(r.notification_preferences)
        : r.notification_preferences || { push: true, email: false, sms: false },
      privacySettings: typeof r.privacy_settings === "string"
        ? JSON.parse(r.privacy_settings)
        : r.privacy_settings || { profileVisible: true, locationVisible: false, activityVisible: true },
      displayPreferences: typeof r.display_preferences === "string"
        ? JSON.parse(r.display_preferences)
        : r.display_preferences || { compactView: false, autoPlay: false, dataSaver: false },
      language: r.language_preference || "en",
      timezone: r.timezone || null,
      bio: r.bio || "",
      phone: r.phone || "",
      occupation: r.occupation || "",
      website: r.website || "",
      twitterHandle: r.twitter_handle || "",
      linkedinUrl: r.linkedin_url || "",
      profileCompleted: r.profile_completed || false,
    });
  } catch (err) {
    console.error("[Settings] GET error:", err);
    return Response.json({ message: "Failed to fetch settings" }, { status: 500 });
  }
}

const settingsUpdateSchema = z.object({
  notificationPreferences: z.object({
    push: z.boolean().default(true),
    email: z.boolean().default(false),
    sms: z.boolean().default(false),
  }).optional(),
  privacySettings: z.object({
    profileVisible: z.boolean().default(true),
    locationVisible: z.boolean().default(false),
    activityVisible: z.boolean().default(true),
  }).optional(),
  displayPreferences: z.object({
    compactView: z.boolean().default(false),
    autoPlay: z.boolean().default(false),
    dataSaver: z.boolean().default(false),
  }).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  occupation: z.string().max(100).optional(),
  website: z.string().max(200).optional(),
  twitterHandle: z.string().max(50).optional(),
  linkedinUrl: z.string().max(200).optional(),
});

/**
 * PATCH /api/user/settings
 * Updates the current user's advanced settings.
 */
export async function PATCH(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid input", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const sql = getDb();

  try {
    if (data.notificationPreferences) {
      await sql`UPDATE platform_users SET notification_preferences = ${JSON.stringify(data.notificationPreferences)}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.privacySettings) {
      await sql`UPDATE platform_users SET privacy_settings = ${JSON.stringify(data.privacySettings)}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.displayPreferences) {
      await sql`UPDATE platform_users SET display_preferences = ${JSON.stringify(data.displayPreferences)}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.language !== undefined) {
      await sql`UPDATE platform_users SET language_preference = ${data.language}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.timezone !== undefined) {
      await sql`UPDATE platform_users SET timezone = ${data.timezone}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.bio !== undefined) {
      await sql`UPDATE platform_users SET bio = ${data.bio}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.phone !== undefined) {
      await sql`UPDATE platform_users SET phone = ${data.phone}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.occupation !== undefined) {
      await sql`UPDATE platform_users SET occupation = ${data.occupation}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.website !== undefined) {
      await sql`UPDATE platform_users SET website = ${data.website}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.twitterHandle !== undefined) {
      await sql`UPDATE platform_users SET twitter_handle = ${data.twitterHandle}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }
    if (data.linkedinUrl !== undefined) {
      await sql`UPDATE platform_users SET linkedin_url = ${data.linkedinUrl}, updated_at = NOW() WHERE clerk_user_id = ${clerkUserId}`;
    }

    return Response.json({ message: "Settings updated successfully" });
  } catch (err) {
    console.error("[Settings] PATCH error:", err);
    return Response.json({ message: "Failed to update settings" }, { status: 500 });
  }
}
