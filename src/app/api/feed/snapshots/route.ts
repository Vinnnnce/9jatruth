import { ensureDbInitialized } from "@/lib/db";
import { getFeedSnapshots } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  try {
    const data = await getFeedSnapshots();
    return Response.json(data);
  } catch (err) {
    console.error("[feed/snapshots] Error:", err);
    return Response.json({ message: "Failed to load feed snapshots" }, { status: 500 });
  }
}
