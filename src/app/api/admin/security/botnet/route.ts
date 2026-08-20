/**
 * GET /api/admin/security/botnet — compute and return botnet clusters.
 * Builds the device graph from device_fingerprints + recent security events
 * and runs connected-components clustering.
 */
import { withSecurity } from "@/lib/security-middleware";
import { getDb } from "@/lib/db";
import {
  buildGraph,
  detectBotnetCluster,
  type DeviceNode,
} from "@/lib/security-engine/botnet-graph";

async function loadDeviceNodes(): Promise<DeviceNode[]> {
  const sql = getDb();
  const rows = (await sql`
    SELECT fingerprint, ip_hash, user_agent, platform, trust_score, is_bot
    FROM device_fingerprints
    WHERE last_seen > NOW() - INTERVAL '7 days'
    ORDER BY request_count DESC
    LIMIT 1000
  `) as unknown as Array<Record<string, any>>;
  return rows.map((r) => ({
    id: r.fingerprint,
    ipHash: r.ip_hash,
    fingerprint: r.fingerprint,
    userAgent: r.user_agent,
    asn: null,
    trustScore: Number(r.trust_score ?? 50),
  }));
}

export const GET = withSecurity(
  async () => {
    const nodes = await loadDeviceNodes();
    const edges = buildGraph(nodes);
    const clusters = detectBotnetCluster(nodes, edges);
    return Response.json({
      totalDevices: nodes.length,
      totalEdges: edges.length,
      clusters,
    });
  },
  {
    requirePermission: "security.botnet.view",
    eventType: "admin_botnet_view",
    rateLimit: { max: 30, windowMs: 60_000 },
  }
);
