import { ensureDbInitialized } from "@/lib/db";
import { batchDecayTruths } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  const updates = await batchDecayTruths();
  return Response.json({ processed: updates.length, updates: updates.slice(0, 20) });
}
