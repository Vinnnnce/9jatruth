/**
 * Client-safe admin auth helpers.
 * These functions don't import any server-only modules and can be
 * safely imported from client components.
 */

// The designated super admin email
export const SUPER_ADMIN_EMAIL = "insights793@gmail.com";

/**
 * Check if a Clerk user email matches the super admin.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Client-side: Check if a user profile object represents the super admin.
 */
export function isSuperAdminProfile(profile: { email?: string; isAdmin?: boolean; is_admin?: boolean } | null | undefined): boolean {
  if (!profile) return false;
  if (isSuperAdminEmail(profile.email)) return true;
  return Boolean(profile.isAdmin ?? profile.is_admin);
}

/**
 * Determine which dashboard a user should see based on their account type.
 * - Super admin email → "admin"
 * - Org admin → "org"
 * - Regular user → "user"
 */
export function getDashboardType(profile: {
  email?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
  isOrgAdmin?: boolean;
  is_org_admin?: boolean;
  organizationId?: number | null;
} | null | undefined): "admin" | "org" | "user" {
  if (!profile) return "user";
  if (isSuperAdminEmail(profile.email) || profile.isAdmin || profile.is_admin) return "admin";
  if (profile.isOrgAdmin || profile.is_org_admin || profile.organizationId) return "org";
  return "user";
}
