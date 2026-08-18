import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getClerkUserId,
} from "@/lib/api-helpers";
import { csrfCheck } from "@/lib/security";
import {
  isKimiConfigured,
  generateKimiJson,
} from "@/lib/kimi";
import { z } from "zod";

const NEWS_CATEGORIES = [
  "politics", "business", "technology", "sports", "entertainment",
  "health", "education", "agriculture", "security", "infrastructure",
  "environment", "local", "national", "international", "opinion",
] as const;

const TONES = [
  "neutral",
  "formal",
  "conversational",
  "urgent",
  "analytical",
  "inspirational",
] as const;

const generateSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  category: z.enum(NEWS_CATEGORIES).default("local"),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  tone: z.enum(TONES).default("neutral"),
});

interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  suggestedCategory: string;
}

/**
 * Build a deterministic placeholder article when Kimi is not configured
 * (or when generation fails). Keeps the generate endpoint usable in dev.
 */
function templateArticle(
  topic: string,
  category: string,
  state: string | undefined,
  lga: string | undefined,
  tone: string
): GeneratedArticle {
  const location = [lga, state].filter(Boolean).join(", ");
  const locationPhrase = location ? ` in ${location}` : " across Nigeria";
  const tonePhrase = tone !== "neutral" ? ` (${tone} tone)` : "";

  const title = `${topic}: A Closer Look${locationPhrase ? ` — ${location}` : ""}`;
  const excerpt = `An overview of ${topic}${locationPhrase}, examining the key developments and what they mean for residents.`;
  const content = [
    `<h2>${sanitizeText(title)}</h2>`,
    `<p><em>${sanitizeText(excerpt)}</em></p>`,
    `<p>This article addresses <strong>${sanitizeText(topic)}</strong>${locationPhrase}.${tonePhrase} The situation continues to develop and remains relevant to communities${locationPhrase ? ` ${locationPhrase}` : " throughout the country"}.</p>`,
    `<h3>Background</h3>`,
    `<p>${sanitizeText(topic)} has emerged as a notable subject of public interest. Stakeholders and residents alike are paying close attention to how events unfold.</p>`,
    `<h3>Key Points</h3>`,
    `<ul>`,
    `<li>The topic of ${sanitizeText(topic)} continues to attract attention${locationPhrase}.</li>`,
    `<li>Local observers note the importance of community engagement and timely information.</li>`,
    `<li>Further updates are expected as more details become available.</li>`,
    `</ul>`,
    `<h3>What This Means</h3>`,
    `<p>For residents${locationPhrase ? ` ${locationPhrase}` : ""}, staying informed about ${sanitizeText(topic)} is essential. Community members are encouraged to share verified information and engage constructively.</p>`,
    `<p><em>This article was generated from a template because AI generation is not configured.</em></p>`,
  ].join("\n");

  const baseTag = topic.toLowerCase().split(/\s+/).slice(0, 2).join("-");
  const tags = [
    baseTag,
    category,
    state ? state.toLowerCase() : "nigeria",
    tone,
  ].filter(Boolean);

  return {
    title,
    excerpt,
    content,
    tags,
    suggestedCategory: category,
  };
}

/**
 * POST /api/news/generate — generate a news article draft with Kimi AI.
 *
 * Accepts { topic, category, state, lga, tone } and returns a generated
 * article (title, excerpt, content, tags, suggestedCategory). Does NOT
 * persist to the database — the client may review and then call
 * /api/news/generate-publish or /api/news/create to save.
 */
export async function POST(request: Request) {
  // Authentication (dev mode pattern — allow anonymous in development)
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes("placeholder") && clerkKey.length > 20;
    if (isClerkConfigured) {
      return Response.json({ message: "Unauthorized — Please sign in to generate articles" }, { status: 401 });
    }
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(generateSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const topic = sanitizeText(data.topic);
  const category = data.category;
  const state = data.state || undefined;
  const lga = data.lga || undefined;
  const tone = data.tone;

  // Fallback template (used when Kimi is unavailable or fails)
  const fallback: GeneratedArticle = templateArticle(
    topic,
    category,
    state,
    lga,
    tone
  );

  // If Kimi is not configured, return the template-generated article
  if (!isKimiConfigured()) {
    return Response.json({
      ...fallback,
      source: "template",
    });
  }

  try {
    const locationParts: string[] = [];
    if (lga) locationParts.push(lga);
    if (state) locationParts.push(state);
    const location = locationParts.join(", ") || "Nigeria";

    const systemPrompt = `You are an expert Nigerian news writer and editor for a civic journalism platform called 9jatruth. You write clear, accurate, and engaging news articles about events and topics relevant to Nigerian communities.

Your task: write a full news article about the given topic.

Guidelines:
- Write a compelling, journalistic headline (title) that is factual and engaging.
- Write a concise excerpt/summary (1-2 sentences, max 300 characters).
- Write the full article body as well-structured HTML (use <h2>, <h3>, <p>, <ul>, <li> tags). The article should be 400-800 words.
- Use the specified tone: ${tone}.
- Focus on the category: ${category}.
- Make the article locally relevant to ${location} (state/LGA) where appropriate.
- Maintain journalistic integrity — be balanced, factual, and avoid sensationalism.
- Do not fabricate specific quotes from real people or invented statistics presented as fact.
- Suggest 3-8 relevant tags (short, lowercase, kebab-case where needed).
- Suggest the most appropriate category from this list: ${NEWS_CATEGORIES.join(", ")}.

Respond with a JSON object of this exact shape:
{
  "title": "string",
  "excerpt": "string",
  "content": "string (HTML)",
  "tags": ["string", ...],
  "suggestedCategory": "string (one of the categories above)"
}`;

    const userPrompt = `Topic: ${topic}
Category: ${category}
Location: ${location}
State: ${state || "Nigeria"}
LGA: ${lga || "N/A"}
Tone: ${tone}

Please generate the full news article as a JSON object.`;

    const { data: article, source } = await generateKimiJson<GeneratedArticle>(
      systemPrompt,
      userPrompt,
      fallback,
      { temperature: 0.7, maxOutputTokens: 4096 }
    );

    // Defensive normalization of the AI output
    const normalized: GeneratedArticle = {
      title:
        typeof article.title === "string" && article.title.trim().length > 0
          ? article.title.trim().slice(0, 300)
          : fallback.title,
      excerpt:
        typeof article.excerpt === "string"
          ? article.excerpt.trim().slice(0, 500)
          : fallback.excerpt,
      content:
        typeof article.content === "string" && article.content.trim().length > 10
          ? article.content.trim()
          : fallback.content,
      tags:
        Array.isArray(article.tags)
          ? article.tags
              .filter((t) => typeof t === "string" && t.trim().length > 0)
              .map((t) => t.trim().toLowerCase().slice(0, 50))
              .slice(0, 20)
          : fallback.tags,
      suggestedCategory:
        typeof article.suggestedCategory === "string" &&
        (NEWS_CATEGORIES as readonly string[]).includes(
          article.suggestedCategory.toLowerCase()
        )
          ? article.suggestedCategory.toLowerCase()
          : fallback.suggestedCategory,
    };

    return Response.json({ ...normalized, source });
  } catch (err) {
    console.error("[news/generate] Failed:", err);
    // Fall back to template on any unexpected error
    return Response.json({ ...fallback, source: "template" });
  }
}
