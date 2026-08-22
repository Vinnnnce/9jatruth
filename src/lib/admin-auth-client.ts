/**
 * Client-safe admin auth helpers.
 * These functions don't import any server-only modules and can be
 * safely imported from client components.
 */

// The designated super admin email
export const SUPER_ADMIN_EMAIL = "9jatruthofficial@gmail.com";

/**
 * Check if a Clerk user email matches the super admin.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Client-side: Check if a user profile object represents the super admin.
 * ONLY the designated email is considered super admin — DB role flags
 * are intentionally excluded to prevent privilege escalation.
 */
export function isSuperAdminProfile(profile: { email?: string; isAdmin?: boolean; is_admin?: boolean } | null | undefined): boolean {
  if (!profile) return false;
  return isSuperAdminEmail(profile.email);
}

/**
 * Determine which dashboard a user should see based on their account type.
 * - Super admin email → "admin" (email-only, not DB role)
 * - Org admin → "org"
 * - Regular user → "user"
 */
export function getDashboardType(profile: {
  email?: string;
  isAdmin?: boolean;
  is_admin?: boolean;
  isSuperAdmin?: boolean;
  isOrgAdmin?: boolean;
  is_org_admin?: boolean;
  organizationId?: number | null;
} | null | undefined): "admin" | "org" | "user" {
  if (!profile) return "user";
  // Super admin — prefer the server-verified flag (Clerk verified emails),
  // fall back to email match. DB isAdmin flag does NOT grant admin dashboard.
  if (profile.isSuperAdmin === true || isSuperAdminEmail(profile.email)) return "admin";
  if (profile.isOrgAdmin || profile.is_org_admin || profile.organizationId) return "org";
  return "user";
}
