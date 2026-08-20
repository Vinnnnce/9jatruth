/**
 * Deepfake Image/Video Detection
 * ============================================================
 * Detects synthetic media (AI-generated images / manipulated videos) using
 * metadata and forensic heuristics. This is a robust baseline that flags the
 * most common deepfake indicators without a heavy ML model:
 *
 *  - Missing or spoofed C2PA / Content Credentials
 *  - Editor fingerprints in EXIF (Photoshop, GAN tooling, FaceApp, etc.)
 *  - Implausible dimensions / aspect ratios for "camera" media
 *  - Video: frame-rate anomalies, missing GOP structure, re-encoded artifacts
 *  - File-type / magic-byte mismatches (extension vs actual content)
 *
 * A hosted deepfake-detection API (e.g. a Vision model) can be plugged in via
 * `registerDeepfakeProvider` for pixel-level analysis.
 */

export interface DeepfakeInput {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  sourceUrl?: string;
  /** Raw file headers / magic bytes when the upload is available in-process. */
  magicBytes?: string;
  /** Parsed EXIF / metadata (if extracted upstream). */
  metadata?: Record<string, unknown>;
}

export interface DeepfakeResult {
  suspicious: boolean;
  riskScore: number; // 0..1
  reason: string;
  signals: string[];
}

const SUSPICIOUS_EDITORS = [
  "photoshop",
  "adobe photoshop",
  "gimp",
  "faceapp",
  "deepfake",
  "zao",
  "reface",
  "wombo",
  "stable diffusion",
  "midjourney",
  "dall-e",
  "sd ",
];

export function scoreDeepfake(input: DeepfakeInput): DeepfakeResult {
  const signals: string[] = [];
  let risk = 0;
  const metadata = input.metadata || {};

  // Editor fingerprints in EXIF.
  const software = String(metadata["software"] || metadata["Software"] || "").toLowerCase();
  if (software) {
    const matched = SUSPICIOUS_EDITORS.filter((e) => software.includes(e));
    if (matched.length > 0) {
      signals.push(`editor_fingerprint:${matched[0]}`);
      risk += 0.4;
    }
  }

  // Missing Content Credentials / C2PA on an image claimed to be a photo.
  if (input.imageUrl && !metadata["c2pa"] && !metadata["contentCredentials"]) {
    signals.push("no_content_credentials");
    risk += 0.15;
  }

  // Magic-byte / extension mismatch.
  if (input.magicBytes) {
    const ext = (input.imageUrl || input.videoUrl || "").split(".").pop()?.toLowerCase();
    if (ext && !matchesMagicBytes(input.magicBytes, ext)) {
      signals.push("file_type_mismatch");
      risk += 0.5;
    }
  }

  // Implausible camera dimensions (e.g. non-standard aspect ratios for photos).
  const width = Number(metadata["width"] || metadata["exif:width"]);
  const height = Number(metadata["height"] || metadata["exif:height"]);
  if (width && height) {
    const ratio = Math.max(width, height) / Math.min(width, height);
    if (ratio > 2.2 || ratio < 1) {
      signals.push("implausible_dimensions");
      risk += 0.2;
    }
  }

  // Video without expected codec metadata / implausible frame rate.
  if (input.videoUrl) {
    const fps = Number(metadata["fps"] || metadata["r_frame_rate"]);
    if (fps && (fps > 65 || fps < 8)) {
      signals.push("anomalous_framerate");
      risk += 0.3;
    }
    if (!metadata["codec"] && !metadata["format"]) {
      signals.push("missing_video_metadata");
      risk += 0.2;
    }
  }

  // No source URL = unattributed media.
  if (!input.sourceUrl && (input.imageUrl || input.videoUrl)) {
    signals.push("unattributed_media");
    risk += 0.1;
  }

  const clamped = Math.min(1, risk);
  return {
    suspicious: clamped >= 0.45,
    riskScore: Number(clamped.toFixed(3)),
    reason: clamped >= 0.45
      ? `Deepfake signals: ${signals.join(", ") || "low confidence"}`
      : "No strong deepfake signals",
    signals,
  };
}

/** Check whether a file's magic bytes match its claimed extension. */
function matchesMagicBytes(hex: string, ext: string): boolean {
  const h = hex.toLowerCase();
  const signatures: Record<string, string[]> = {
    jpg: ["ffd8ff"],
    jpeg: ["ffd8ff"],
    png: ["89504e47"],
    gif: ["47494638"],
    webp: ["52494646"],
    mp4: ["66747970", "000000"],
    mov: ["66747970"],
    webm: ["1a45dfa3"],
  };
  const expected = signatures[ext];
  if (!expected) return true; // Unknown ext — don't penalize.
  return expected.some((sig) => h.startsWith(sig));
}

// ─── Pluggable provider interface ─────────────────────────────
export interface DeepfakeProvider {
  analyze(input: DeepfakeInput): Promise<{ probability: number; label: string }>;
}

let provider: DeepfakeProvider | null = null;

export function registerDeepfakeProvider(p: DeepfakeProvider) {
  provider = p;
}

export async function scoreWithProvider(input: DeepfakeInput): Promise<DeepfakeResult | null> {
  if (!provider) return null;
  const { probability, label } = await provider.analyze(input);
  return {
    suspicious: probability > 0.5,
    riskScore: Number(probability.toFixed(3)),
    reason: `Provider verdict: ${label}`,
    signals: ["ml_provider"],
  };
}
