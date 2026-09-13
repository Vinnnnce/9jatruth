import { csrfCheck } from "@/lib/security";
import { ensureDbInitialized, getDb } from "@/lib/db";
import { isSuperAdmin } from "@/lib/admin-auth";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Super Admin User Status Management
 *
 * POST /api/admin/users/[id]/status
 * Body: { action: "block" | "suspend" | "restore" | "delete", reason?: string, suspendedUntil?: string }
 *
 * - BLOCK: Sets user status to 'blocked', prevents login
 * - SUSPEND: Sets user status to 'suspended', optional suspendedUntil date
 * - RESTORE: Sets user status back to 'active'
 * - DELETE: Hard delete the user record
 *
 * All actions are logged in the audit_log table.
 * Also attempts to sync Clerk user state when Clerk is configured.
 */

const statusSchema = z.object({
  action: z.enum(["block", "suspend", "restore", "delete"]),
  reason: z.string().max(500).optional(),
  suspendedUntil: z.string().datetime().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  await ensureDbInitialized();

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json(
      { message: "Forbidden — Super admin access required" },
      { status: 403 }
    );
  }

  const adminClerkId = await getClerkUserId();
  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) {
    return Response.json({ message: "Invalid user id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { message: "Invalid request body", errors: parsed.error.issues },
      { status: 400 }
    );
  }

  const { action, reason, suspendedUntil } = parsed.data;
  const sql = getDb();

  // Verify user exists
  const users = (await sql`
    SELECT id, clerk_user_id, email, display_name, status FROM platform_users WHERE id = ${numericId} LIMIT 1
  `) as unknown as any[];

  if (users.length === 0) {
    return Response.json({ message: "User not found" }, { status: 404 });
  }

  const targetUser = users[0];

  // Prevent self-action
  if (targetUser.clerk_user_id === adminClerkId) {
    return Response.json(
      { message: "Cannot modify your own account" },
      { status: 400 }
    );
  }

  try {
    if (action === "delete") {
      // Hard delete — cascade will handle related records
      await sql`DELETE FROM platform_users WHERE id = ${numericId}`;

      // Sync Clerk: ban the user
      await syncClerkUserState(targetUser.clerk_user_id, "delete");

      // Audit log
      await sql`
        INSERT INTO audit_log (admin_clerk_id, action, target_type, target_id, target_email, reason, metadata)
        VALUES (${adminClerkId}, 'DELETE_USER', 'user', ${numericId}, ${targetUser.email}, ${reason ?? null}, ${JSON.stringify({ deleted: true })})
      `;

      return Response.json({
        success: true,
        message: "User deleted successfully",
        action: "delete",
      });
    }

    if (action === "block") {
      await sql`
        UPDATE platform_users
        SET status = 'blocked', suspended_until = NULL, updated_at = NOW()
        WHERE id = ${numericId}
      `;
      await syncClerkUserState(targetUser.clerk_user_id, "block");

      await sql`
        INSERT INTO audit_log (admin_clerk_id, action, target_type, target_id, target_email, reason, metadata)
        VALUES (${adminClerkId}, 'BLOCK_USER', 'user', ${numericId}, ${targetUser.email}, ${reason ?? null}, ${JSON.stringify({ status: "blocked" })})
      `;

      return Response.json({
        success: true,
        message: "User blocked successfully",
        action: "block",
      });
    }

    if (action === "suspend") {
      const until = suspendedUntil ? new Date(suspendedUntil) : null;
      await sql`
        UPDATE platform_users
        SET status = 'suspended', suspended_until = ${until}, updated_at = NOW()
        WHERE id = ${numericId}
      `;
      await syncClerkUserState(targetUser.clerk_user_id, "suspend");

      await sql`
        INSERT INTO audit_log (admin_clerk_id, action, target_type, target_id, target_email, reason, metadata)
        VALUES (${adminClerkId}, 'SUSPEND_USER', 'user', ${numericId}, ${targetUser.email}, ${reason ?? null}, ${JSON.stringify({ status: "suspended", suspendedUntil: until?.toISOString() ?? null })})
      `;

      return Response.json({
        success: true,
        message: "User suspended successfully",
        action: "suspend",
      });
    }

    if (action === "restore") {
      await sql`
        UPDATE platform_users
        SET status = 'active', suspended_until = NULL, updated_at = NOW()
        WHERE id = ${numericId}
      `;
      await syncClerkUserState(targetUser.clerk_user_id, "restore");

      await sql`
        INSERT INTO audit_log (admin_clerk_id, action, target_type, target_id, target_email, reason, metadata)
        VALUES (${adminClerkId}, 'RESTORE_USER', 'user', ${numericId}, ${targetUser.email}, ${reason ?? null}, ${JSON.stringify({ status: "active" })})
      `;

      return Response.json({
        success: true,
        message: "User restored successfully",
        action: "restore",
      });
    }

    return Response.json({ message: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    console.error("[admin/users/status] Error:", err);
    return Response.json(
      { message: "Failed to update user status", error: String(err) },
      { status: 500 }
    );
  }
}

/**
 * Sync user state with Clerk.
 * When Clerk is configured, bans/unbans the user in Clerk.
 * In dev mode (no Clerk), this is a no-op.
 */
async function syncClerkUserState(
  clerkUserId: string | null,
  action: "block" | "suspend" | "restore" | "delete"
): Promise<void> {
  if (!clerkUserId) return;

  const clerkKey = process.env.CLERK_SECRET_KEY;
  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const isClerkConfigured =
    clerkPubKey &&
    !clerkPubKey.includes("placeholder") &&
    clerkPubKey.length > 20;

  if (!isClerkConfigured || !clerkKey) return;

  try {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();

    if (action === "delete") {
      // Delete the user from Clerk
      await client.users.deleteUser(clerkUserId);
    } else if (action === "block" || action === "suspend") {
      // Ban the user in Clerk
      await client.users.banUser(clerkUserId);
    } else if (action === "restore") {
      // Unban the user in Clerk
      await client.users.unbanUser(clerkUserId);
    }
  } catch (err) {
    console.error("[Clerk sync] Failed to sync user state:", err);
    // Non-fatal — DB state is the source of truth
  }
}
