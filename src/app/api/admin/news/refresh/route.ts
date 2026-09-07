import { ensureDbInitialized } from "@/lib/db";
import { fetchAndStoreAllNews } from "@/lib/news-external";
import { requireSuperAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/news/refresh — super-admin trigger to fetch & store news
 * immediately (instead of waiting for the daily cron). Uses the same logic as
 * the cron, including the RSS fallback when NewsAPI is unavailable.
 */
export async function POST() {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  try {
    const summary = await fetchAndStoreAllNews();
    return Response.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/news/refresh] Fatal error:", msg);
    return Response.json(
      {
        message: "Failed to fetch and store news",
        error: msg,
        fetched: 0,
        stored: 0,
        categories: [],
        errors: [msg],
      },
      { status: 500 }
    );
  }
}
