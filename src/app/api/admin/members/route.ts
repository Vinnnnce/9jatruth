/**
 * GET  /api/admin/members — list security team members.
 * POST /api/admin/members — invite/add a member with assigned roles.
 * PATCH /api/admin/members — update a member's roles or active state.
 */
import { withSecurity } from "@/lib/security-middleware";
import {
  listMembers,
  createMember,
  updateMemberRoles,
  setMemberActive,
} from "@/lib/security-engine/security-storage";
import { ROLES } from "@/lib/security-engine/rbac";
import { z } from "zod";

const validRoleIds = ROLES.map((r) => r.id);

export const GET = withSecurity(
  async () => {
    const members = await listMembers();
    return Response.json({ members, roles: ROLES });
  },
  {
    requirePermission: "security.members.manage",
    eventType: "admin_members_view",
    rateLimit: { max: 60, windowMs: 60_000 },
  }
);

const createSchema = z.object({
  email: z.string().email().max(200),
  displayName: z.string().trim().min(1).max(100),
  roleIds: z.array(z.string()).min(1).default(["security_analyst"]),
});

export const POST = withSecurity(
  async (request) => {
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid payload", errors: parsed.error.issues }, { status: 400 });
    }
    const invalidRoles = parsed.data.roleIds.filter((r) => !validRoleIds.includes(r));
    if (invalidRoles.length > 0) {
      return Response.json(
        { message: `Unknown role(s): ${invalidRoles.join(", ")}` },
        { status: 400 }
      );
    }
    // super_admin role can only be assigned by the super admin (enforced by
    // the requirePermission guard + the fact that only super admin holds
    // security.members.manage by default). Block explicit super_admin assignment
    // here to keep the role implicit to the designated email.
    if (parsed.data.roleIds.includes("super_admin")) {
      return Response.json(
        { message: "The super_admin role is implicit and cannot be assigned." },
        { status: 400 }
      );
    }
    const member = await createMember({
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      roleIds: parsed.data.roleIds,
    });
    return Response.json({ success: true, member });
  },
  {
    requirePermission: "security.members.manage",
    eventType: "admin_member_create",
    rateLimit: { max: 20, windowMs: 60_000 },
  }
);

const updateSchema = z.object({
  id: z.number().int().positive(),
  roleIds: z.array(z.string()).min(1).optional(),
  active: z.boolean().optional(),
});

export const PATCH = withSecurity(
  async (request) => {
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ message: "Invalid payload", errors: parsed.error.issues }, { status: 400 });
    }
    const { id, roleIds, active } = parsed.data;
    if (roleIds) {
      if (roleIds.includes("super_admin")) {
        return Response.json(
          { message: "The super_admin role is implicit and cannot be assigned." },
          { status: 400 }
        );
      }
      const invalidRoles = roleIds.filter((r) => !validRoleIds.includes(r));
      if (invalidRoles.length > 0) {
        return Response.json(
          { message: `Unknown role(s): ${invalidRoles.join(", ")}` },
          { status: 400 }
        );
      }
      await updateMemberRoles(id, roleIds);
    }
    if (active !== undefined) {
      await setMemberActive(id, active);
    }
    return Response.json({ success: true });
  },
  {
    requirePermission: "security.members.manage",
    eventType: "admin_member_update",
    rateLimit: { max: 30, windowMs: 60_000 },
  }
);
