import { ensureDbInitialized } from "@/lib/db";
import { getGeoHierarchy } from "@/lib/neon-storage";

/**
 * Returns the geo hierarchy data for dropdowns:
 * regions, states, LGAs, communities, villages.
 */
export async function GET() {
  await ensureDbInitialized();
  const hierarchy = await getGeoHierarchy();
  return Response.json(hierarchy);
}
