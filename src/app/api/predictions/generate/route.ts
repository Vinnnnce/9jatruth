import { ensureDbInitialized } from "@/lib/db";
import { runAllPredictions } from "@/lib/neon-storage";
import { getClerkUserId } from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import { isSuperAdminEmail } from "@/lib/admin-auth-client";
import { currentUser } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  await ensureDbInitialized();
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  // Restrict to super admin only
  const user = await currentUser();
  const email = user?.emailAddresses?.find(
    (e: any) => e.id === user.primaryEmailAddressId
  )?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";

  if (!isSuperAdminEmail(email)) {
    return Response.json({ message: "Admin access required" }, { status: 403 });
  }

  const result = await runAllPredictions();
  return Response.json({ success: true, ...result });
}
