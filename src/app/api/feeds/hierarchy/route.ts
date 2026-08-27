import { ensureDbInitialized } from "@/lib/db";
import { getFeedHierarchy } from "@/lib/community-feed-storage";

/**
 * GET /api/feeds/hierarchy
 * Returns the cascading State → LGA → Ward → Community data for the filter
 * dropdowns. Merges DB reference rows with the static Nigerian dataset so all
 * 37 states + 774 LGAs are always available even before the DB is fully seeded.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDbInitialized();
  try {
    const hierarchy = await getFeedHierarchy();
    return Response.json(hierarchy);
  } catch (err) {
    console.error("[api/feeds/hierarchy] Error:", err);
    return Response.json({
      states: [],
      lgasByState: {},
      wardsByLga: {},
      communitiesByWard: {},
      dbStates: [],
      dbLgas: [],
      dbWards: [],
      dbCommunities: [],
    });
  }
}
