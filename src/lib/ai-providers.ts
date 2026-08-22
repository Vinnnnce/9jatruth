/**
 * Unified AI Provider Layer — Deepseek + Kimi K3 (Moonshot)
 * ---------------------------------------------------------
 * Server-only module that abstracts all AI calls on 9jatruth.
 *
 * Strategy (ensemble / relay):
 *   1. Primary: Deepseek (deepseek-chat) — fast, cheap, strong at tool/JSON.
 *   2. Fallback: Kimi K3 (Moonshot) — long context, second opinion.
 *
 * Both APIs are OpenAI-compatible (Chat Completions). Keys are read from env
 * and NEVER exposed to the client. When a provider is not configured it is
 * skipped automatically, so the platform degrades gracefully (Deepseek-only,
 * Kimi-only, or pure heuristic fallback) without throwing.
 *
 * Use `generateAiText` / `generateAiJson` for all new AI features. Existing
 * `@/lib/kimi` helpers remain available for backward compatibility.
 */

import { generateKimiText, generateKimiJson, isKimiConfigured } from "@/lib/kimi";

// ─── Deepseek configuration ────────────────────────────────────────────────

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";

export function isDeepseekConfigured(): boolean {
  return !!DEEPSEEK_API_KEY && DEEPSEEK_API_KEY.length > 10;
}

export function getDeepseekModel(): string {
  return DEEPSEEK_MODEL;
}

/**
 * Which providers are currently available, in priority order.
 */
export function availableProviders(): Array<"deepseek" | "kimi"> {
  const list: Array<"deepseek" | "kimi"> = [];
  if (isDeepseekConfigured()) list.push("deepseek");
  if (isKimiConfigured()) list.push("kimi");
  return list;
}

/** True when at least one AI provider is configured. */
export function isAiConfigured(): boolean {
  return availableProviders().length > 0;
}

// ─── Deepseek low-level call ───────────────────────────────────────────────

async function callDeepseek(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<string | null> {
  if (!isDeepseekConfigured()) return null;

  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      console.error(
        "[Deepseek] API error:",
        res.status,
        await res.text().catch(() => "")
      );
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch (err) {
    console.error("[Deepseek] Request failed:", err);
    return null;
  }
}

// ─── Public ensemble API ───────────────────────────────────────────────────

export type AiSource = "deepseek" | "kimi" | "fallback";

export interface AiTextResult {
  text: string | null;
  source: AiSource;
}

/**
 * Generate text using the ensemble: try Deepseek first, then Kimi.
 * Returns { text: null, source: "fallback" } when no provider succeeds.
 */
export async function generateAiText(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<AiTextResult> {
  // 1. Deepseek (primary)
  if (isDeepseekConfigured()) {
    const text = await callDeepseek(systemPrompt, userPrompt, options);
    if (text) return { text, source: "deepseek" };
  }

  // 2. Kimi K3 (fallback)
  if (isKimiConfigured()) {
    const text = await generateKimiText(systemPrompt, userPrompt, options);
    if (text) return { text, source: "kimi" };
  }

  return { text: null, source: "fallback" };
}

/**
 * Defensive JSON extraction — handles markdown fences, prose wrappers,
 * and partial output by locating the outermost balanced {…} or […].
 */
function extractJson(raw: string): unknown | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/g, "")
      .trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const parsed = tryParse(cleaned.substring(firstBrace, lastBrace + 1));
    if (parsed !== null) return parsed;
  }

  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const parsed = tryParse(cleaned.substring(firstBracket, lastBracket + 1));
    if (parsed !== null) return parsed;
  }

  return tryParse(cleaned);
}

/**
 * Generate structured JSON via the ensemble. Falls back to the provided
 * default value when no provider returns parseable JSON.
 */
export async function generateAiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<{ data: T; source: AiSource }> {
  // 1. Deepseek
  if (isDeepseekConfigured()) {
    const raw = await callDeepseek(systemPrompt, userPrompt, options);
    if (raw) {
      const parsed = extractJson(raw);
      if (parsed !== null) {
        return { data: parsed as T, source: "deepseek" };
      }
    }
  }

  // 2. Kimi (already has defensive JSON parsing)
  if (isKimiConfigured()) {
    const { data, source } = await generateKimiJson<T>(
      systemPrompt,
      userPrompt,
      fallback,
      options
    );
    if (source === "kimi") return { data, source: "kimi" };
  }

  return { data: fallback, source: "fallback" };
}

/**
 * Generate a JSON array via the ensemble.
 */
export async function generateAiJsonArray<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T[],
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<{ data: T[]; source: AiSource }> {
  const result = await generateAiJson<T[]>(
    systemPrompt,
    `${userPrompt}\n\nRespond with a JSON array only.`,
    fallback,
    { temperature: options?.temperature ?? 0.6, maxOutputTokens: options?.maxOutputTokens ?? 2048 }
  );
  return { data: result.data, source: result.source };
}
