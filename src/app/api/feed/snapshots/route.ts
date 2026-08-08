import { ensureDbInitialized } from "@/lib/db";
import { getFeedSnapshots } from "@/lib/neon-storage";

export async function GET(request: Request) {
  await ensureDbInitialized();
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region") || undefined;
    const state = searchParams.get("state") || undefined;
    const lga = searchParams.get("lga") || undefined;
    const data = await getFeedSnapshots(region, state, lga);
    return Response.json(data);
  } catch (err) {
    console.error("[feed/snapshots] Error:", err);
    return Response.json({ message: "Failed to load feed snapshots" }, { status: 500 });
  }
}
