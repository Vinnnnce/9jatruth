import { ensureDbInitialized } from "@/lib/db";
import { getWeeklyReviews } from "@/lib/neon-storage";
import { requireSuperAdmin } from "@/lib/admin-auth";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const adminCheck = await requireSuperAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const url = new URL(request.url);
    const weekStart = url.searchParams.get("week_start") || undefined;
    const data = await getWeeklyReviews(weekStart);
    return Response.json(data);
  } catch (err) {
    console.error("[admin/weekly-review] Error:", err);
    return Response.json({ message: "Failed to load weekly reviews" }, { status: 500 });
  }
}
