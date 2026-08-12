import { ensureDbInitialized } from "@/lib/db";
import { DATA_PLANS } from "@/lib/telecom";
import { getClerkUserId } from "@/lib/api-helpers";

/**
 * GET /api/telecom/data-plans — list available data plans per network
 */
export async function GET(request: Request) {
  await ensureDbInitialized();

  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) return Response.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const network = searchParams.get("network");

  const networks = ["MTN", "Airtel", "Glo", "9mobile"];

  if (network) {
    const plans = (DATA_PLANS as any)[network];
    if (!plans) {
      return Response.json({ message: "Unknown network" }, { status: 400 });
    }
    return Response.json({
      network,
      plans: plans.map((p: any) => ({
        code: p.code,
        name: p.name,
        amount: p.amount,
        validity: p.validity,
        size: p.size,
      })),
    });
  }

  // Return all networks
  const allPlans = networks.map((n) => ({
    network: n,
    plans: (DATA_PLANS as any)[n].map((p: any) => ({
      code: p.code,
      name: p.name,
      amount: p.amount,
      validity: p.validity,
      size: p.size,
    })),
  }));

  return Response.json({ networks: allPlans });
}
