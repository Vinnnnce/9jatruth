import { POST as featureConfigUpdate } from "@/app/api/admin/feature-config/update/route";

/**
 * POST /api/admin/features/update
 *
 * Alias for /api/admin/feature-config/update — toggles feature flags.
 * Kept for route naming compatibility with the API contract.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return featureConfigUpdate(request);
}
