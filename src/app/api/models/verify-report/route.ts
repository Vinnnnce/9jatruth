import { ensureDbInitialized } from "@/lib/db";
import { runReportVerification } from "@/lib/neon-storage";
import { getUserId } from "@/lib/api-helpers";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const { content, category, neighborhoodId } = await request.json();
  if (!content || !category || !neighborhoodId) {
    return Response.json(
      { message: "content, category, and neighborhoodId are required" },
      { status: 400 }
    );
  }
  const deviceHash = await getUserId(request);
  const result = await runReportVerification({ content, category, deviceHash, neighborhoodId });
  return Response.json(result);
}
