import { ensureDbInitialized } from "@/lib/db";
import { deleteFeed, restoreFeed } from "@/lib/community-feed-storage";
import { getUserId, getClerkUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";

/**
 * DELETE /api/feeds/[id]  — soft-delete a feed (removed from site, kept in DB).
 * Owners may delete their own posts; super admins may delete any.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const { id } = await params;
  const feedId = parseInt(id, 10);
  if (!Number.isFinite(feedId)) return Response.json({ message: "Invalid id" }, { status: 400 });

  const userHash = await getUserId(request).catch(() => null);
  if (!userHash) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const isAdmin = await isSuperAdmin();

  const result = await deleteFeed(feedId, userHash, isAdmin);
  if (!result.deleted) {
    return Response.json({ message: "Post not found or you lack permission to delete it" }, { status: 404 });
  }
  return Response.json({ ok: true, id: feedId });
}

/**
 * POST /api/feeds/[id]/restore  — super-admin restore a soft-deleted feed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const feedId = parseInt(id, 10);
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  const result = await restoreFeed(feedId);
  return Response.json(result);
}
