/**
 * Zero-Trust RBAC (Role-Based Access Control)
 * ============================================================
 * Least-privilege role + permission system for the security team. The super
 * admin (email-gated) can invite members, assign roles, and scope each
 * member's dashboard to only the permissions they hold.
 *
 * Design:
 *  - Permissions are granular, deny-by-default strings (e.g. "security.threats.view").
 *  - Roles bundle permissions; members are assigned one or more roles.
 *  - The super admin implicitly holds ALL permissions and cannot be removed.
 *  - Every access check is logged for the audit trail (zero-trust: never trust,
 *    always verify + log).
 */

export type Permission =
  | "security.dashboard.view"
  | "security.threats.view"
  | "security.threats.mitigate"
  | "security.devices.view"
  | "security.botnet.view"
  | "security.fraud.view"
  | "security.content.review"
  | "security.content.verify"
  | "security.members.manage"
  | "security.roles.manage"
  | "security.rules.manage"
  | "security.alerts.view"
  | "security.alerts.acknowledge"
  | "security.audit.view"
  | "security.2fa.manage"
  | "security.apikeys.manage";

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  /** Whether this role can be assigned by org-level admins or only super admin. */
  superAdminOnly?: boolean;
}

export const ROLES: RoleDefinition[] = [
  {
    id: "security_analyst",
    name: "Security Analyst",
    description: "Monitors threats, devices, and fraud signals. Read-only mitigation.",
    permissions: [
      "security.dashboard.view",
      "security.threats.view",
      "security.devices.view",
      "security.botnet.view",
      "security.fraud.view",
      "security.alerts.view",
      "security.audit.view",
    ],
  },
  {
    id: "content_moderator",
    name: "Content Moderator",
    description: "Verifies news authenticity and reviews deepfake/media flags.",
    permissions: [
      "security.dashboard.view",
      "security.content.review",
      "security.content.verify",
      "security.threats.view",
    ],
  },
  {
    id: "fraud_analyst",
    name: "Fraud Analyst",
    description: "Investigates reward and telecom fraud, can mitigate active abuse.",
    permissions: [
      "security.dashboard.view",
      "security.fraud.view",
      "security.threats.view",
      "security.threats.mitigate",
      "security.alerts.view",
      "security.alerts.acknowledge",
    ],
  },
  {
    id: "security_manager",
    name: "Security Manager",
    description: "Full operational access plus member and rule management.",
    permissions: [
      "security.dashboard.view",
      "security.threats.view",
      "security.threats.mitigate",
      "security.devices.view",
      "security.botnet.view",
      "security.fraud.view",
      "security.content.review",
      "security.content.verify",
      "security.members.manage",
      "security.rules.manage",
      "security.alerts.view",
      "security.alerts.acknowledge",
      "security.audit.view",
      "security.2fa.manage",
    ],
  },
  {
    id: "super_admin",
    name: "Super Admin",
    description: "Full access. Implicitly held by the designated super admin email.",
    superAdminOnly: true,
    permissions: [
      "security.dashboard.view",
      "security.threats.view",
      "security.threats.mitigate",
      "security.devices.view",
      "security.botnet.view",
      "security.fraud.view",
      "security.content.review",
      "security.content.verify",
      "security.members.manage",
      "security.roles.manage",
      "security.rules.manage",
      "security.alerts.view",
      "security.alerts.acknowledge",
      "security.audit.view",
      "security.2fa.manage",
      "security.apikeys.manage",
    ],
  },
];

export function getRole(roleId: string): RoleDefinition | undefined {
  return ROLES.find((r) => r.id === roleId);
}

export function getAllPermissions(): Permission[] {
  const set = new Set<Permission>();
  for (const role of ROLES) {
    for (const p of role.permissions) set.add(p);
  }
  return Array.from(set);
}

/**
 * Resolve the effective permission set for a member given their assigned roles.
 */
export function resolvePermissions(roleIds: string[]): Permission[] {
  const set = new Set<Permission>();
  for (const id of roleIds) {
    const role = getRole(id);
    if (!role) continue;
    for (const p of role.permissions) set.add(p);
  }
  return Array.from(set);
}

export function hasPermission(
  permissions: Permission[],
  required: Permission
): boolean {
  return permissions.includes(required);
}

/**
 * The super admin email implicitly grants every permission. This is checked
 * alongside role-based permissions so the super admin is never locked out.
 */
export function isSuperAdminEmailCheck(email: string | null | undefined): boolean {
  if (!email) return false;
  const superAdminEmail =
    process.env.SUPER_ADMIN_EMAIL || "9jatruthofficial@gmail.com";
  return email.toLowerCase().trim() === superAdminEmail.toLowerCase().trim();
}

export interface MemberAccount {
  id: number;
  email: string;
  displayName: string;
  clerkUserId?: string | null;
  roleIds: string[];
  active: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
  createdAt: string;
  lastActiveAt?: string | null;
}

/** Default dashboard landing tab for a member based on their strongest role. */
export function defaultDashboardTab(roleIds: string[]): string {
  if (roleIds.includes("super_admin")) return "overview";
  if (roleIds.includes("security_manager")) return "overview";
  if (roleIds.includes("fraud_analyst")) return "fraud";
  if (roleIds.includes("content_moderator")) return "content";
  if (roleIds.includes("security_analyst")) return "threats";
  return "overview";
}
