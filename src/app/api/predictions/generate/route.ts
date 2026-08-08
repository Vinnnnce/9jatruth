import { ensureDbInitialized } from "@/lib/db";
import { runAllPredictions } from "@/lib/neon-storage";
import { getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });
  const result = await runAllPredictions();
  return Response.json({ success: true, ...result });
}
