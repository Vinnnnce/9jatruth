/**
 * Server-only admin auth helpers.
 * These must only be imported from server components or API routes.
 */

import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from "./admin-auth-client";

export { isSuperAdminEmail, SUPER_ADMIN_EMAIL };

/**
 * Server-side: Check if the current request user is the super admin.
 * Uses Clerk's currentUser() to get the email directly.
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

    if (isClerkConfigured) {
      const user = await currentUser();
      if (!user) return false;
      const email = user.emailAddresses?.find(
        (e: any) => e.id === user.primaryEmailAddressId
      )?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "";
      return isSuperAdminEmail(email);
    }

    // Fallback: check via env var for dev mode
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    return isSuperAdminEmail(adminEmail);
  } catch {
    return false;
  }
}

/**
 * Server-side: Require super admin access, return error Response if not authorized.
 */
export async function requireSuperAdmin(): Promise<{ ok: true } | { error: Response }> {
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return {
      error: Response.json(
        { message: "Forbidden — Super admin access required" },
        { status: 403 }
      ),
    };
  }
  return { ok: true };
}
