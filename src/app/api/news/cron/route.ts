import { ensureDbInitialized } from "@/lib/db";
import { fetchAndStoreAllNews } from "@/lib/news-external";

export const dynamic = "force-dynamic";

/**
 * GET /api/news/cron — Vercel cron-compatible endpoint to fetch & store news
 *
 * Auth (any of):
 *   - `x-cron-secret` header matching process.env.CRON_SECRET
 *   - `authorization: Bearer <CRON_SECRET>` (Vercel cron standard)
 *   - Vercel's automatic `CRON_SECRET` env injection (checked via authorization header)
 *
 * In dev mode (NODE_ENV !== "production"), auth is optional.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  // Check multiple auth methods for Vercel cron compatibility
  const xCronSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const isDev = process.env.NODE_ENV !== "production";
  const isAuthorized =
    (cronSecret && xCronSecret === cronSecret) ||
    (cronSecret && bearerToken === cronSecret);

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
    console.error("[news/cron] Fatal error:", msg);
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

/**
 * POST /api/news/cron — same as GET, for non-Vercel cron systems that use POST
 */
export async function POST(request: Request) {
  return GET(request);
}
