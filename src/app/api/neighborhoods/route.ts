import { ensureDbInitialized } from "@/lib/db";
import { getNeighborhoods } from "@/lib/neon-storage";

export async function GET() {
  await ensureDbInitialized();
  const result = await getNeighborhoods();
  return Response.json(result);
}
