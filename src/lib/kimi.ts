/**
 * Kimi K3 AI Integration Layer
 *
 * Server-only module for calling Moonshot AI's Kimi K3 API.
 * The API is OpenAI-compatible (Chat Completions format).
 * Provides structured JSON generation with graceful fallback
 * when the API key is not configured.
 *
 * Never expose the API key to the client side.
 * This module is only imported by server-side route handlers.
 */

const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_MODEL = process.env.KIMI_MODEL || "kimi-k3";
const KIMI_BASE_URL = process.env.KIMI_BASE_URL || "https://api.moonshot.ai/v1";

export function isKimiConfigured(): boolean {
  return !!KIMI_API_KEY && KIMI_API_KEY.length > 10;
}

export function getKimiModel(): string {
  return KIMI_MODEL;
}

/**
 * Generate text from Kimi K3 with a system instruction and user prompt.
 * Returns the raw text response or null on failure.
 */
export async function generateKimiText(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean }
): Promise<string | null> {
  if (!isKimiConfigured()) return null;

  const url = `${KIMI_BASE_URL}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens ?? 1024,
        ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      console.error("[Kimi] API error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch (err) {
    console.error("[Kimi] Request failed:", err);
    return null;
  }
}

/**
 * Generate structured JSON from Kimi K3.
 * Parses the response defensively — handles markdown fences, prose wrappers, etc.
 * Returns the fallback if Kimi is unavailable or parsing fails.
 */
export async function generateKimiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<{ data: T; source: "kimi" | "fallback" }> {
  const raw = await generateKimiText(systemPrompt, userPrompt, {
    ...options,
    jsonMode: true,
  });

  if (!raw) {
    return { data: fallback, source: "fallback" };
  }

  // Defensive JSON extraction
  let cleaned = raw.trim();

  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  // Find the first { and last } to extract JSON
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  // Try object extraction first
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      return { data: parsed as T, source: "kimi" };
    } catch {
      // fall through to array attempt
    }
  }

  // Try array extraction
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonStr = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      return { data: parsed as T, source: "kimi" };
    } catch {
      // fall through
    }
  }

  // Direct parse attempt
  try {
    const parsed = JSON.parse(cleaned);
    return { data: parsed as T, source: "kimi" };
  } catch {
    console.error("[Kimi] Failed to parse JSON response");
    return { data: fallback, source: "fallback" };
  }
}

/**
 * Batch generate JSON arrays from Kimi K3.
 * Useful for generating predictions for multiple neighborhoods at once.
 */
export async function generateKimiJsonArray<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T[],
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<{ data: T[]; source: "kimi" | "fallback" }> {
  const result = await generateKimiJson<T[]>(
    systemPrompt,
    userPrompt + "\n\nRespond with a JSON array.",
    fallback,
    { temperature: options?.temperature ?? 0.6, maxOutputTokens: options?.maxOutputTokens ?? 2048 }
  );
  return { data: result.data, source: result.source };
}
