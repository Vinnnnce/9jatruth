import { ensureDbInitialized } from "@/lib/db";
import { aggregateEventTimeSeries } from "@/lib/neon-storage";
import { getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdminEmail } from "@/lib/admin-auth-client";
import { currentUser } from "@clerk/nextjs/server";

/**
 * POST /api/ai/aggregate
 * Triggers time-series aggregation. Admin-only endpoint.
 * Aggregates truth reports into daily/weekly/monthly buckets.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  // Require admin access
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Check super admin
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e: any) => e.id === user.primaryEmailAddressId
  )?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";

  if (!isSuperAdminEmail(email)) {
    return Response.json({ message: "Admin access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const period = (url.searchParams.get("period") || "all") as "daily" | "weekly" | "monthly" | "yearly" | "all";

  const results: any[] = [];

  if (period === "all" || period === "daily") {
    results.push(await aggregateEventTimeSeries("daily"));
  }
  if (period === "all" || period === "weekly") {
    results.push(await aggregateEventTimeSeries("weekly"));
  }
  if (period === "all" || period === "monthly") {
    results.push(await aggregateEventTimeSeries("monthly"));
  }
  if (period === "all" || period === "yearly") {
    results.push(await aggregateEventTimeSeries("yearly"));
  }

  return Response.json({
    success: true,
    results,
  });
}
