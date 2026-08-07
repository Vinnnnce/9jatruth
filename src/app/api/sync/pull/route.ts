import { ensureDbInitialized } from "@/lib/db";
import { handleSyncPull } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const deviceHash = await getUserId(request);
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since") || undefined;
  const neighborhoodsParam = searchParams.get("neighborhoods");
  const neighborhoods = neighborhoodsParam
    ? neighborhoodsParam
        .split(",")
        .map((n) => parseInt(n))
        .filter((n) => !isNaN(n))
    : undefined;
  const result = await handleSyncPull({ deviceHash, since, neighborhoods });
  return Response.json(result);
}
