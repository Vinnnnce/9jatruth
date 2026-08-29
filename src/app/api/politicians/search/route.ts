import { ensureDbInitialized } from "@/lib/db";
import { queryPoliticians } from "@/lib/politics";

/**
 * GET /api/politicians/search?q=...
 *
 * Search politicians by name using the shared queryPoliticians helper.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await ensureDbInitialized();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 500);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

    if (!q.trim()) {
      return Response.json({ politicians: [], count: 0, query: q });
    }

    const politicians = await queryPoliticians({
      search: q.trim(),
      limit,
      offset,
    });

    return Response.json({
      politicians,
      count: politicians.length,
      query: q,
    });
  } catch (err: any) {
    console.error("[politicians/search] GET failed:", err);
    return Response.json({ message: "Failed to search politicians" }, { status: 500 });
  }
}
