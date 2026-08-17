import { csrfCheck } from "@/lib/security";
import { isKimiConfigured, generateKimiText } from "@/lib/kimi";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * POST /api/ai/summarize
 *
 * Accepts { text, title, level } and returns a streamed, newline-delimited
 * JSON (NDJSON) response so the client can progressively render the summary
 * as it becomes available. The final line always contains the complete
 * SummaryResult object with `done: true`.
 *
 * Uses the Kimi K3 integration when configured (see src/lib/kimi.ts). Falls
 * back to a local, dependency-free heuristic summarizer otherwise (or if the
 * Kimi call fails / returns unparsable output).
 */

const summarizeSchema = z.object({
  text: z.string().min(1, "text is required").max(50_000),
  title: z.string().max(500).optional().default(""),
  level: z.enum(["short", "medium", "deep"]).optional().default("medium"),
});

export type SummaryLevel = "short" | "medium" | "deep";

export type SummaryResult = {
  summary: string[];
  keyInsights: string[];
  whyItMatters: string;
  actionableTakeaways: string[];
  source: "kimi" | "heuristic";
  level: SummaryLevel;
};

const LEVEL_SENTENCE_COUNT: Record<SummaryLevel, number> = {
  short: 3,
  medium: 5,
  deep: 8,
};

// ─── Heuristic summarizer (no external AI dependency) ───

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "to",
  "of", "in", "on", "at", "by", "with", "as", "is", "was", "are", "were",
  "be", "been", "being", "it", "its", "this", "that", "these", "those",
  "he", "she", "they", "them", "his", "her", "their", "our", "we", "you",
  "your", "i", "me", "my", "mine", "us", "will", "would", "could", "should",
  "can", "may", "might", "must", "shall", "not", "no", "nor", "so", "than",
  "too", "very", "just", "about", "into", "over", "after", "before",
  "between", "out", "up", "down", "off", "again", "further", "once",
  "there", "here", "when", "where", "why", "how", "all", "any", "both",
  "each", "few", "more", "most", "other", "some", "such", "only", "own",
  "same", "from", "also", "has", "have", "had", "do", "does", "did",
  "said", "says", "according", "one", "two", "three",
]);

const IMPACT_KEYWORDS = [
  "impact", "affect", "significant", "important", "matter", "concern",
  "risk", "threat", "benefit", "consequence", "result", "lead to",
  "cause", "crucial", "critical", "essential", "danger", "warn",
  "increase", "decrease", "rise", "fall", "growth", "decline", "crisis",
  "because", "therefore", "as a result", "effect",
];

const ACTION_KEYWORDS = [
  "should", "must", "need to", "recommend", "urge", "call for", "plan",
  "propose", "announce", "launch", "implement", "advise", "suggest",
  "will", "going to", "next step", "action", "measure", "policy",
  "initiative", "response", "aim to", "seek to", "in order to",
];

function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const rough = cleaned.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [cleaned];
  return rough
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreSentences(sentences: string[]): { sentence: string; score: number; index: number }[] {
  const freq: Record<string, number> = {};
  const tokenizedSentences = sentences.map(tokenize);

  for (const tokens of tokenizedSentences) {
    for (const word of tokens) {
      freq[word] = (freq[word] || 0) + 1;
    }
  }

  return sentences.map((sentence, index) => {
    const tokens = tokenizedSentences[index];
    let score = tokens.reduce((sum, w) => sum + (freq[w] || 0), 0);
    // Normalize by length so overly long sentences don't dominate purely by word count
    score = tokens.length > 0 ? score / Math.sqrt(tokens.length) : 0;
    // Slight boost for earlier sentences (lede bias, common in news writing)
    const positionBoost = index === 0 ? 1.5 : index < 3 ? 1.2 : 1;
    return { sentence, score: score * positionBoost, index };
  });
}

function containsAny(sentence: string, keywords: string[]): boolean {
  const lower = sentence.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function heuristicSummarize(text: string, title: string, level: SummaryLevel): SummaryResult {
  const sentences = splitSentences(text);
  const targetCount = LEVEL_SENTENCE_COUNT[level];

  if (sentences.length === 0) {
    return {
      summary: [title ? `No detailed content available for "${title}".` : "No content available to summarize."],
      keyInsights: [],
      whyItMatters: "Not enough content was provided to determine impact.",
      actionableTakeaways: [],
      source: "heuristic",
      level,
    };
  }

  const scored = scoreSentences(sentences);
  const ranked = [...scored].sort((a, b) => b.score - a.score);

  const selectedCount = level === "deep" ? sentences.length : Math.min(targetCount, sentences.length);
  const topSentences = ranked
    .slice(0, selectedCount)
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence);

  const summary = topSentences.map((s) => s.trim());

  // Key insights: top-scored sentences (most information-dense), independent of order
  const insightCount = level === "short" ? 2 : level === "medium" ? 3 : 5;
  const keyInsights = ranked
    .slice(0, Math.min(insightCount, ranked.length))
    .sort((a, b) => a.index - b.index)
    .map((s) => s.sentence.trim());

  // Why it matters: sentences with impact-related language, else fall back to top sentence
  const impactSentences = sentences.filter((s) => containsAny(s, IMPACT_KEYWORDS));
  const whyItMatters =
    impactSentences.length > 0
      ? impactSentences.slice(0, 2).join(" ")
      : `${ranked[0]?.sentence?.trim() ?? "This story"} is relevant because it reflects developments that could influence public discussion, policy, or daily life for those affected.`;

  // Actionable takeaways: sentences with action-oriented language
  const actionSentences = sentences.filter((s) => containsAny(s, ACTION_KEYWORDS));
  const actionCount = level === "short" ? 2 : level === "medium" ? 3 : 4;
  const actionableTakeaways =
    actionSentences.length > 0
      ? actionSentences.slice(0, actionCount).map((s) => s.trim())
      : [
          "Stay informed by following official updates related to this story.",
          "Consider how this development may affect your community or interests.",
        ].slice(0, actionCount);

  return {
    summary,
    keyInsights,
    whyItMatters,
    actionableTakeaways,
    source: "heuristic",
    level,
  };
}

// ─── Kimi-backed summarizer ───

function buildKimiPrompt(text: string, title: string, level: SummaryLevel) {
  const lengthGuidance =
    level === "short"
      ? "Keep it very concise: 3 bullet points max."
      : level === "medium"
      ? "Moderate detail: 5 bullet points."
      : "Comprehensive detail: 8 bullet points covering all major aspects.";

  const system =
    "You are a news summarization engine for a Nigerian news app. " +
    "You always respond with strict, valid JSON only — no markdown fences, no prose outside the JSON object. " +
    'The JSON object must have exactly these keys: "summary" (array of strings, bullet points), ' +
    '"keyInsights" (array of strings, the most important takeaways), ' +
    '"whyItMatters" (a single string paragraph explaining significance), ' +
    '"actionableTakeaways" (array of strings, concrete actions or things readers should watch for). ' +
    lengthGuidance;

  const user = `Article title: ${title || "(untitled)"}\n\nArticle content:\n${text}\n\nSummarize this article as instructed.`;

  return { system, user };
}

function parseKimiResponse(raw: string): Omit<SummaryResult, "source" | "level"> | null {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  try {
    const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    const summary = Array.isArray(parsed.summary) ? parsed.summary.map(String) : [];
    const keyInsights = Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [];
    const actionableTakeaways = Array.isArray(parsed.actionableTakeaways)
      ? parsed.actionableTakeaways.map(String)
      : [];
    const whyItMatters = typeof parsed.whyItMatters === "string" ? parsed.whyItMatters : "";

    if (summary.length === 0 && keyInsights.length === 0 && !whyItMatters) return null;

    return { summary, keyInsights, whyItMatters, actionableTakeaways };
  } catch {
    return null;
  }
}

// ─── Streaming helpers ───

/**
 * Builds an NDJSON stream: emits progress "chunk" events as each section of
 * the summary becomes available, then a final event with the complete
 * payload and `done: true`. This lets the client progressively render
 * results even though the underlying generation is not truly token-streamed.
 */
function streamSummaryResult(result: SummaryResult): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        emit({ type: "start", level: result.level, source: result.source });
        await new Promise((r) => setTimeout(r, 30));

        emit({ type: "summary", summary: result.summary });
        await new Promise((r) => setTimeout(r, 30));

        emit({ type: "keyInsights", keyInsights: result.keyInsights });
        await new Promise((r) => setTimeout(r, 30));

        emit({ type: "whyItMatters", whyItMatters: result.whyItMatters });
        await new Promise((r) => setTimeout(r, 30));

        emit({ type: "actionableTakeaways", actionableTakeaways: result.actionableTakeaways });
        await new Promise((r) => setTimeout(r, 20));

        emit({ type: "done", done: true, result });
      } catch (err) {
        emit({
          type: "error",
          done: true,
          message: err instanceof Error ? err.message : "Streaming failed",
        });
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(request: Request) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = summarizeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Invalid input", errors: parsed.error.issues }, { status: 400 });
  }

  const { text, title, level } = parsed.data;

  let result: SummaryResult;

  if (isKimiConfigured()) {
    try {
      const { system, user } = buildKimiPrompt(text, title, level);
      const raw = await generateKimiText(system, user, {
        temperature: 0.4,
        maxOutputTokens: level === "deep" ? 1400 : level === "medium" ? 900 : 500,
      });

      const kimiParsed = raw ? parseKimiResponse(raw) : null;

      if (kimiParsed) {
        result = { ...kimiParsed, source: "kimi", level };
      } else {
        result = heuristicSummarize(text, title, level);
      }
    } catch (err) {
      console.error("[api/ai/summarize] Kimi generation failed, falling back:", err);
      result = heuristicSummarize(text, title, level);
    }
  } else {
    result = heuristicSummarize(text, title, level);
  }

  const stream = streamSummaryResult(result);

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Summary-Source": result.source,
    },
  });
}
