import { ensureDbInitialized } from "@/lib/db";
import { deleteAllTruths } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";

/**
 * Delete all truths/posts and verifications (demo data cleanup).
 * Super admin only.
 */
export async function DELETE() {
  await ensureDbInitialized();

  const isAdmin = await isSuperAdmin();
  if (!isAdmin) {
    return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  }

  const result = await deleteAllTruths();
  return Response.json({ ...result, message: "All posts and verifications deleted" });
}
