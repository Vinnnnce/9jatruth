/**
 * AI Security Monitor
 *
 * Uses Kimi K3 to analyze incoming requests and content for suspicious patterns.
 * Acts as a backend security layer that flags potentially malicious activity.
 *
 * Features:
 * - Content injection detection (SQLi, XSS, path traversal)
 * - Suspicious request pattern detection
 * - Automated threat logging
 */

import { isKimiConfigured, generateKimiText } from "@/lib/kimi";

const SUSPICIOUS_PATTERNS = [
  // SQL injection
  /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bDROP\b|\bDELETE\b|\bUPDATE\b).*(\bFROM\b|\bINTO\b|\bTABLE\b)/i,
  /'.*(OR|AND).*'=/i,
  /;\s*(DROP|DELETE|UPDATE|INSERT)/i,
  // XSS
  /<script[^>]*>/i,
  /on(load|error|click|mouseover|focus)\s*=/i,
  /javascript:/i,
  // Path traversal
  /\.\.\//,
  /\.\.\\/,
  // Command injection
  /(\$\(|`|\|\||&&|;).*(cat|ls|rm|wget|curl|bash|sh)/i,
];

const RATE_ABUSE_THRESHOLD = 50; // requests per minute from same IP

const requestLog = new Map<string, { count: number; lastSeen: number }>();

/**
 * Quick heuristic check for suspicious content.
 * Runs synchronously — no AI needed for obvious patterns.
 */
export function detectSuspiciousContent(content: string): {
  suspicious: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];

  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      patterns.push(pattern.source.substring(0, 50));
    }
  }

  return {
    suspicious: patterns.length > 0,
    patterns,
  };
}

/**
 * Track request frequency per IP for rate abuse detection.
 */
export function trackRequest(ip: string): boolean {
  const now = Date.now();
  const entry = requestLog.get(ip);

  if (!entry || now - entry.lastSeen > 60_000) {
    requestLog.set(ip, { count: 1, lastSeen: now });
    return false;
  }

  entry.count++;
  entry.lastSeen = now;

  return entry.count > RATE_ABUSE_THRESHOLD;
}

/**
 * AI-powered deep content analysis.
 * Uses Kimi K3 to analyze content that passed heuristic checks
 * but may still be suspicious.
 *
 * Returns analysis result or null if AI is not configured.
 */
export async function aiContentAnalysis(
  content: string,
  context: string = "API request"
): Promise<{
  threatLevel: "safe" | "suspicious" | "malicious";
  reason: string;
} | null> {
  if (!isKimiConfigured()) return null;

  // Don't send very long content to AI
  const truncated = content.substring(0, 2000);

  const systemPrompt = `You are a security analysis AI. Analyze the given content for potential security threats including SQL injection, XSS, path traversal, command injection, prompt injection, and other malicious patterns. Respond with a threat level and brief reason.

Respond in this exact format:
Threat: [safe/suspicious/malicious]
Reason: [1 sentence explanation]`;

  const userPrompt = `Analyze this ${context} content for security threats:

"${truncated}"`;

  try {
    const aiText = await generateKimiText(systemPrompt, userPrompt, {
      temperature: 0.1,
      maxOutputTokens: 128,
    });

    if (!aiText) return null;

    const threatMatch = aiText.match(/threat:\s*(safe|suspicious|malicious)/i);
    const reasonMatch = aiText.match(/reason:\s*(.+)/i);

    if (threatMatch) {
      return {
        threatLevel: threatMatch[1].toLowerCase() as "safe" | "suspicious" | "malicious",
        reason: reasonMatch ? reasonMatch[1].trim() : "AI flagged this content",
      };
    }
  } catch (err) {
    console.error("[AI Security] Analysis failed:", err);
  }

  return null;
}

/**
 * Comprehensive security check for incoming requests.
 * Combines heuristic and AI analysis.
 */
export async function securityCheck(
  content: string,
  ip: string,
  context: string = "API request"
): Promise<{ allowed: boolean; reason?: string; threatLevel?: string }> {
  // 1. Check for rate abuse
  if (trackRequest(ip)) {
    return { allowed: false, reason: "Rate abuse detected", threatLevel: "suspicious" };
  }

  // 2. Heuristic content check
  const heuristic = detectSuspiciousContent(content);
  if (heuristic.suspicious) {
    return {
      allowed: false,
      reason: `Blocked by heuristic: ${heuristic.patterns.join(", ")}`,
      threatLevel: "malicious",
    };
  }

  // 3. AI deep analysis (optional, only if Kimi is configured)
  const aiResult = await aiContentAnalysis(content, context);
  if (aiResult && aiResult.threatLevel === "malicious") {
    return {
      allowed: false,
      reason: aiResult.reason,
      threatLevel: "malicious",
    };
  }

  return { allowed: true };
}
