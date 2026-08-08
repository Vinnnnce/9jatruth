import { ensureDbInitialized } from "@/lib/db";
import { getNeighborhood, getSnapshot, getTruths, runPredictiveOutageModel } from "@/lib/neon-storage";
import { isSuperAdmin } from "@/lib/admin-auth";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const isAdmin = await isSuperAdmin();
  if (!isAdmin) return Response.json({ message: "Forbidden — Super admin access required" }, { status: 403 });
  const { neighborhoodId } = await request.json();
  if (!neighborhoodId) {
    return Response.json({ message: "neighborhoodId is required" }, { status: 400 });
  }
  const neighborhood = await getNeighborhood(neighborhoodId);
  if (!neighborhood) return Response.json({ message: "Neighborhood not found" }, { status: 404 });
  const snapshot = await getSnapshot(neighborhoodId);
  if (!snapshot) return Response.json({ message: "Snapshot not found" }, { status: 404 });
  const powerTruths = await getTruths(30, neighborhoodId, "power");
  const result = runPredictiveOutageModel({ neighborhood, snapshot, powerTruths });
  return Response.json(result);
}
