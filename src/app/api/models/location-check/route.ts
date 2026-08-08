import { ensureDbInitialized } from "@/lib/db";
import { getNeighborhood, runLocationConsistency } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";
import { isSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  const { reportLat, reportLng, neighborhoodId, reportTimestamp } = await request.json();
  if (!neighborhoodId) {
    return Response.json({ message: "neighborhoodId is required" }, { status: 400 });
  }
  const neighborhood = await getNeighborhood(neighborhoodId);
  if (!neighborhood) {
    return Response.json({ message: "Neighborhood not found" }, { status: 404 });
  }
  const deviceHash = await getUserId(request);
  const result = await runLocationConsistency({
    reportLat,
    reportLng,
    neighborhood,
    deviceHash,
    reportTimestamp: reportTimestamp || new Date().toISOString(),
  });
  return Response.json(result);
}
