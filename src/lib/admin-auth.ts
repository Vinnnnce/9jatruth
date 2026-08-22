/**
 * Server-only admin auth helpers.
 * These must only be imported from server components or API routes.
 */

import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { isSuperAdminEmail, SUPER_ADMIN_EMAIL } from "./admin-auth-client";

export { isSuperAdminEmail, SUPER_ADMIN_EMAIL };

/**
 * The super admin email, overridable via the SUPER_ADMIN_EMAIL env var.
 * Defaults to the designated 9jatruth official address.
 */
export function getSuperAdminEmail(): string {
  return (process.env.SUPER_ADMIN_EMAIL || SUPER_ADMIN_EMAIL).toLowerCase().trim();
}

/**
 * Server-side: Check if the current request user is the super admin.
 * Matches ANY verified email address on the Clerk user (not just the primary),
 * so the super admin still works if 9jatruthofficial@gmail.com is a secondary
 * verified email. Falls back to the env var when Clerk isn't configured.
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;

    if (isClerkConfigured) {
      const user = await currentUser();
      if (!user) return false;
      const target = getSuperAdminEmail();
      const verifiedEmails = (user.emailAddresses ?? [])
        .filter((e: any) => e.verification?.status === "verified" || e.verificationStatus === "verified")
        .map((e: any) => (e.emailAddress || "").toLowerCase().trim())
        .filter(Boolean);
      // Also include the primary email even if verification status shape differs
      const primary = user.primaryEmailAddress?.emailAddress?.toLowerCase().trim();
      const candidates = new Set([...verifiedEmails, ...(primary ? [primary] : [])]);
      return candidates.has(target);
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
