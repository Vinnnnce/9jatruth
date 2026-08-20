/**
 * Mesh Packet Anomaly Detection
 * ============================================================
 * The platform supports offline-first mesh sync (see shared/schema.ts
 * `syncQueue` / `mesh_events`). This detector flags anomalous sync bundles:
 *
 *  - Oversized bundles (payload flooding)
 *  - High duplicate-ratio (replay / sync loops)
 *  - Implausible packet counts from a single device
 *  - Bundle sizes inconsistent with the recorded record count
 */

export interface MeshInput {
  packetCount: number;
  bundleSize: number; // bytes
  deviceHash: string;
  duplicateRatio?: number; // 0..1
}

export interface MeshAnomalyResult {
  suspicious: boolean;
  riskScore: number; // 0..1
  reason: string;
  signals: string[];
}

const MAX_BUNDLE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PACKETS_PER_BUNDLE = 500;
const MAX_DUPLICATE_RATIO = 0.3;

export function scoreMeshAnomaly(input: MeshInput): MeshAnomalyResult {
  const signals: string[] = [];
  let risk = 0;

  if (input.bundleSize > MAX_BUNDLE_BYTES) {
    signals.push("oversized_bundle");
    risk += Math.min(0.4, ((input.bundleSize - MAX_BUNDLE_BYTES) / MAX_BUNDLE_BYTES) * 0.4);
  }

  if (input.packetCount > MAX_PACKETS_PER_BUNDLE) {
    signals.push("excessive_packet_count");
    risk += Math.min(0.3, ((input.packetCount - MAX_PACKETS_PER_BUNDLE) / MAX_PACKETS_PER_BUNDLE) * 0.3);
  }

  if (input.duplicateRatio !== undefined && input.duplicateRatio > MAX_DUPLICATE_RATIO) {
    signals.push("high_duplicate_ratio");
    risk += Math.min(0.3, (input.duplicateRatio - MAX_DUPLICATE_RATIO) * 0.5);
  }

  // Bundle size vs packet count consistency — ~1KB+ per packet is normal;
  // <100 bytes per packet across many packets suggests metadata flooding.
  if (input.packetCount > 50) {
    const bytesPerPacket = input.bundleSize / input.packetCount;
    if (bytesPerPacket < 100) {
      signals.push("metadata_flooding_pattern");
      risk += 0.2;
    }
  }

  const clamped = Math.min(1, risk);
  return {
    suspicious: clamped >= 0.4,
    riskScore: Number(clamped.toFixed(3)),
    reason: clamped >= 0.4
      ? `Mesh anomaly: ${signals.join(", ")}`
      : "Mesh bundle within normal bounds",
    signals,
  };
}
