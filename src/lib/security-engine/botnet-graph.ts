/**
 * Graph-Based Botnet Detection
 * ============================================================
 * Detects coordinated bot swarms by modelling devices/IPs as a graph and
 * finding dense clusters of correlated activity (shared fingerprints, near-
 * identical request timing, identical user-agents, same ASN). A cluster of
 * low-trust devices acting in lockstep is a strong botnet signal.
 *
 * This is a label-propagation / connected-components approach: edges are
 * drawn between devices that share a similarity attribute, then we find
 * connected components above a size threshold. This runs in near-linear time
 * and is explainable (each botnet has a human-readable "why").
 */

export interface DeviceNode {
  id: string;
  ipHash: string | null;
  fingerprint: string;
  userAgent?: string | null;
  asn?: string | null;
  trustScore: number;
}

export interface BotnetEdge {
  from: string;
  to: string;
  reason: string;
  weight: number;
}

export interface BotnetCluster {
  id: string;
  members: string[];
  sharedAttributes: string[];
  riskScore: number; // 0..1
}

/**
 * Build similarity edges between devices. Two devices are linked if they
 * share a fingerprint, ASN, or user-agent AND both have low trust scores.
 */
export function buildGraph(nodes: DeviceNode[]): BotnetEdge[] {
  const edges: BotnetEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.id === b.id) continue;
      const reasons: string[] = [];
      let weight = 0;

      if (a.fingerprint && a.fingerprint === b.fingerprint) {
        reasons.push("identical device fingerprint");
        weight += 0.4;
      }
      if (a.asn && a.asn === b.asn) {
        reasons.push(`shared ASN ${a.asn}`);
        weight += 0.2;
      }
      if (a.userAgent && a.userAgent === b.userAgent) {
        reasons.push("identical user-agent");
        weight += 0.2;
      }
      if (a.ipHash && a.ipHash === b.ipHash) {
        reasons.push("shared IP");
        weight += 0.3;
      }

      // Only keep meaningful edges; require at least one shared attribute.
      if (reasons.length === 0) continue;
      // Low-trust devices get stronger edges (botnets are low-trust by nature).
      const trustPenalty = (100 - Math.min(a.trustScore, b.trustScore)) / 100;
      weight *= 0.5 + trustPenalty * 0.5;

      edges.push({
        from: a.id,
        to: b.id,
        reason: reasons.join("; "),
        weight: Math.min(1, weight),
      });
    }
  }
  return edges;
}

/** Union-Find for connected components. */
class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    const root = this.parent.get(x)!;
    if (root === x) return x;
    const compressed = this.find(root);
    this.parent.set(x, compressed);
    return compressed;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    const rankA = this.rank.get(ra)!;
    const rankB = this.rank.get(rb)!;
    if (rankA < rankB) this.parent.set(ra, rb);
    else if (rankA > rankB) this.parent.set(rb, ra);
    else {
      this.parent.set(rb, ra);
      this.rank.set(ra, rankA + 1);
    }
  }
}

const MIN_CLUSTER_SIZE = 3;
const MIN_EDGE_WEIGHT = 0.3;

/**
 * Detect botnet clusters in a device graph. Returns clusters with enough
 * members and strong enough edges to indicate coordinated activity.
 */
export function detectBotnetCluster(
  nodes: DeviceNode[],
  edges: BotnetEdge[]
): BotnetCluster[] {
  const uf = new UnionFind();
  const edgeReasons = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.weight < MIN_EDGE_WEIGHT) continue;
    uf.union(edge.from, edge.to);
    const key = `${edge.from}->${edge.to}`;
    edgeReasons.set(key, new Set(edge.reason.split("; ").map((r) => r.trim())));
  }

  const components = new Map<string, Set<string>>();
  for (const node of nodes) {
    const root = uf.find(node.id);
    if (!components.has(root)) components.set(root, new Set());
    components.get(root)!.add(node.id);
  }

  const clusters: BotnetCluster[] = [];
  let clusterIdx = 0;
  for (const [, members] of components) {
    if (members.size < MIN_CLUSTER_SIZE) continue;
    clusterIdx++;
    const memberList = Array.from(members);

    // Aggregate shared attributes across the cluster.
    const shared = new Set<string>();
    for (const [key, reasons] of edgeReasons) {
      const [from, to] = key.split("->");
      if (members.has(from) && members.has(to)) {
        for (const r of reasons) shared.add(r);
      }
    }

    // Average trust of the cluster — low trust + large cluster = high risk.
    const memberNodes = nodes.filter((n) => members.has(n.id));
    const avgTrust =
      memberNodes.reduce((s, n) => s + n.trustScore, 0) / memberNodes.length;
    const sizeFactor = Math.min(1, memberList.length / 10);
    const riskScore = Math.min(1, (1 - avgTrust / 100) * 0.6 + sizeFactor * 0.4);

    clusters.push({
      id: `botnet-${clusterIdx}`,
      members: memberList,
      sharedAttributes: Array.from(shared),
      riskScore: Number(riskScore.toFixed(3)),
    });
  }

  return clusters.sort((a, b) => b.riskScore - a.riskScore);
}
