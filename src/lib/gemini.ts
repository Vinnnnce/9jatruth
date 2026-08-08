/**
 * Gemini AI Integration Layer
 *
 * Server-only module for calling Google's Gemini API.
 * Provides structured JSON generation with graceful fallback
 * when the API key is not configured.
 *
 * Never expose the API key to the client side.
 * This module is only imported by server-side route handlers.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY && GEMINI_API_KEY.length > 10;
}

export function getGeminiModel(): string {
  return GEMINI_MODEL;
}

/**
 * Generate text from Gemini with a system instruction and user prompt.
 * Returns the raw text response or null on failure.
 */
export async function generateGeminiText(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxOutputTokens?: number; jsonMode?: boolean }
): Promise<string | null> {
  if (!isGeminiConfigured()) return null;

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxOutputTokens ?? 1024,
          ...(options?.jsonMode ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    if (!res.ok) {
      console.error("[Gemini] API error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === "string" ? text : null;
  } catch (err) {
    console.error("[Gemini] Request failed:", err);
    return null;
  }
}

/**
 * Generate structured JSON from Gemini.
 * Parses the response defensively — handles markdown fences, prose wrappers, etc.
 * Returns the fallback if Gemini is unavailable or parsing fails.
 */
export async function generateGeminiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<{ data: T; source: "gemini" | "fallback" }> {
  const raw = await generateGeminiText(systemPrompt, userPrompt, {
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
      return { data: parsed as T, source: "gemini" };
    } catch {
      // fall through to array attempt
    }
  }

  // Try array extraction
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonStr = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(jsonStr);
      return { data: parsed as T, source: "gemini" };
    } catch {
      // fall through
    }
  }

  // Direct parse attempt
  try {
    const parsed = JSON.parse(cleaned);
    return { data: parsed as T, source: "gemini" };
  } catch {
    console.error("[Gemini] Failed to parse JSON response");
    return { data: fallback, source: "fallback" };
  }
}

/**
 * Batch generate JSON arrays from Gemini.
 * Useful for generating predictions for multiple neighborhoods at once.
 */
export async function generateGeminiJsonArray<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T[],
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<{ data: T[]; source: "gemini" | "fallback" }> {
  const result = await generateGeminiJson<T[]>(
    systemPrompt,
    userPrompt + "\n\nRespond with a JSON array.",
    fallback,
    { temperature: options?.temperature ?? 0.6, maxOutputTokens: options?.maxOutputTokens ?? 2048 }
  );
  return { data: result.data, source: result.source };
}
