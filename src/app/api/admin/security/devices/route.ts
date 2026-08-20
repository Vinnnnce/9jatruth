/**
 * GET /api/admin/security/devices — list tracked device fingerprints.
 */
import { withSecurity } from "@/lib/security-middleware";
import { getDevices } from "@/lib/security-engine/security-storage";

export const GET = withSecurity(
  async (request) => {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 100);
    const devices = await getDevices(limit);
    return Response.json(devices);
  },
  {
    requirePermission: "security.devices.view",
    eventType: "admin_devices_view",
    rateLimit: { max: 60, windowMs: 60_000 },
  }
);
