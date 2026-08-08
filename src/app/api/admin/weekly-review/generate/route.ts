import { ensureDbInitialized } from "@/lib/db";
import { generateWeeklyReviews } from "@/lib/neon-storage";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const adminCheck = await requireSuperAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const result = await generateWeeklyReviews();
    return Response.json({ success: true, ...result });
  } catch (err) {
    console.error("[admin/weekly-review/generate] Error:", err);
    return Response.json({ message: "Failed to generate weekly reviews" }, { status: 500 });
  }
}
