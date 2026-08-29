import { ensureDbInitialized } from "@/lib/db";
import { fetchAndStoreAllNews } from "@/lib/news-external";

export const dynamic = "force-dynamic";

/**
 * POST /api/news/fetch-external — cron job endpoint to fetch & store news
 *
 * Auth: `x-cron-secret` header must match process.env.CRON_SECRET.
 * In dev mode (NODE_ENV !== "production"), auth is optional.
 */
export async function POST(request: Request) {
  // Auth check
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("x-cron-secret");

  const isDev = process.env.NODE_ENV !== "production";
  const isAuthorized =
    cronSecret && providedSecret === cronSecret;

  if (!isAuthorized && !(isDev && !cronSecret)) {
    return Response.json(
      { message: "Unauthorized — invalid or missing cron secret" },
      { status: 401 }
    );
  }

  await ensureDbInitialized();

  try {
    const summary = await fetchAndStoreAllNews();
    return Response.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[fetch-external] Fatal error:", msg);
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
