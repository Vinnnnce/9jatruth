import { ensureDbInitialized } from "@/lib/db";
import { getClerkUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { verifyOrganization } from "@/lib/neon-storage";
import { csrfCheck } from "@/lib/security";

/**
 * POST /api/admin/organizations/[id]/verify
 * Super-admin verify/accept (verified=true) or reject (verified=false) a
 * pending organization. Body: { verified: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDbInitialized();
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const orgId = parseInt(id, 10);
  if (!Number.isFinite(orgId)) return Response.json({ message: "Invalid id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const verified = body.verified === true || body.verified === 1;
  const reviewerHash = clerkUserId;

  const org = await verifyOrganization(orgId, verified, reviewerHash);
  if (!org) return Response.json({ message: "Organization not found" }, { status: 404 });
  return Response.json({ ok: true, organization: org });
}
