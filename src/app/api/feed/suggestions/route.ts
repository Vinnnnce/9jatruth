import { ensureDbInitialized } from "@/lib/db";
import { generatePostSuggestions } from "@/lib/neon-storage";
import { getClerkUserId, getUserId } from "@/lib/api-helpers";

export async function GET(request: Request) {
  await ensureDbInitialized();
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "5", 10);

    const clerkUserId = await getClerkUserId();
    const userHash = await getUserId(request);

    const suggestions = await generatePostSuggestions({
      clerkUserId,
      userHash,
      limit,
    });

    return Response.json({ suggestions });
  } catch (err) {
    console.error("[feed/suggestions] Error:", err);
    return Response.json({ suggestions: [], message: "Failed to generate suggestions" }, { status: 500 });
  }
}
