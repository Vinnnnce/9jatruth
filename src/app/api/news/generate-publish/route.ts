import { ensureDbInitialized, getDb } from "@/lib/db";
import {
  validate,
  validationErrorResponse,
  sanitizeText,
  getUserId,
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

const generatePublishSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  category: z.enum(NEWS_CATEGORIES).default("local"),
  state: z.string().max(100).optional(),
  lga: z.string().max(100).optional(),
  tone: z.enum(TONES).default("neutral"),
  status: z.enum(["draft", "published"]).default("draft"),
  // Optional overrides — if a client already generated an article, it can
  // pass the generated fields directly to skip re-generation.
  title: z.string().trim().min(3).max(300).optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(10).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  suggestedCategory: z.enum(NEWS_CATEGORIES).optional(),
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
 * (or when generation fails). Keeps the endpoint usable in dev.
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

  const title = `${topic}: A Closer Look${location ? ` — ${location}` : ""}`;
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
 * POST /api/news/generate-publish — generate a news article with Kimi AI
 * AND persist it to the news_articles table in a single step.
 *
 * Accepts { topic, category, state, lga, tone, status } plus optional
 * pre-generated overrides (title, excerpt, content, tags, suggestedCategory).
 * Returns the saved article row.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  // Authentication (dev mode pattern)
  const clerkUserId = await getClerkUserId();
  if (!clerkUserId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const userHash = await getUserId(request);
  const sql = getDb();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = validate(generatePublishSchema, body);
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const data = parsed.data;

  const topic = sanitizeText(data.topic);
  const category = data.category;
  const state = data.state || null;
  const lga = data.lga || null;
  const tone = data.tone;
  const status = data.status;

  // ─── Resolve article content ────────────────────────────────────────────
  // If all the core fields were passed in, use them directly (client already
  // generated via /api/news/generate and is now publishing). Otherwise,
  // generate with Kimi (or fall back to the template).
  let title: string;
  let excerpt: string | null;
  let content: string;
  let tags: string[];
  let suggestedCategory: string;
  let source: string;

  const hasOverride =
    typeof data.title === "string" &&
    typeof data.content === "string" &&
    data.content.trim().length >= 10;

  if (hasOverride) {
    title = sanitizeText(data.title!);
    excerpt = data.excerpt ? sanitizeText(data.excerpt) : null;
    content = data.content!;
    tags = data.tags ?? [];
    suggestedCategory = data.suggestedCategory ?? category;
    source = "provided";
  } else {
    const fallback: GeneratedArticle = templateArticle(
      topic,
      category,
      state || undefined,
      lga || undefined,
      tone
    );

    if (!isKimiConfigured()) {
      title = fallback.title;
      excerpt = fallback.excerpt;
      content = fallback.content;
      tags = fallback.tags;
      suggestedCategory = fallback.suggestedCategory;
      source = "template";
    } else {
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

        const { data: article, source: aiSource } =
          await generateKimiJson<GeneratedArticle>(
            systemPrompt,
            userPrompt,
            fallback,
            { temperature: 0.7, maxOutputTokens: 4096 }
          );

        title =
          typeof article.title === "string" && article.title.trim().length > 0
            ? article.title.trim().slice(0, 300)
            : fallback.title;
        excerpt =
          typeof article.excerpt === "string"
            ? article.excerpt.trim().slice(0, 500)
            : fallback.excerpt;
        content =
          typeof article.content === "string" &&
          article.content.trim().length > 10
            ? article.content.trim()
            : fallback.content;
        tags = Array.isArray(article.tags)
          ? article.tags
              .filter((t) => typeof t === "string" && t.trim().length > 0)
              .map((t) => t.trim().toLowerCase().slice(0, 50))
              .slice(0, 20)
          : fallback.tags;
        suggestedCategory =
          typeof article.suggestedCategory === "string" &&
          (NEWS_CATEGORIES as readonly string[]).includes(
            article.suggestedCategory.toLowerCase()
          )
            ? article.suggestedCategory.toLowerCase()
            : fallback.suggestedCategory;
        source = aiSource;
      } catch (err) {
        console.error("[news/generate-publish] AI generation failed:", err);
        title = fallback.title;
        excerpt = fallback.excerpt;
        content = fallback.content;
        tags = fallback.tags;
        suggestedCategory = fallback.suggestedCategory;
        source = "template";
      }
    }
  }

  // ─── Look up author info ────────────────────────────────────────────────
  let authorName = "Anonymous";
  let authorType = "user";
  let organizationId: number | null = null;
  try {
    const userRows = (await sql`
      SELECT display_name, role, is_admin, is_org_admin, organization_id
      FROM platform_users WHERE clerk_user_id = ${clerkUserId}
    `) as unknown as any[];
    if (userRows.length > 0) {
      authorName = userRows[0].display_name || "User";
      authorType = userRows[0].is_admin
        ? "admin"
        : userRows[0].is_org_admin
          ? "agency"
          : "user";
      organizationId = userRows[0].organization_id ?? null;
    }
  } catch {
    // Non-critical
  }

  // Use the suggested category if the caller didn't explicitly override
  const finalCategory =
    suggestedCategory && (NEWS_CATEGORIES as readonly string[]).includes(suggestedCategory)
      ? suggestedCategory
      : category;

  // ─── Persist to the database ───────────────────────────────────────────
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) + `-${Date.now().toString(36)}`;

  const publishedAt = status === "published" ? new Date() : null;

  try {
    const rows = (await sql`
      INSERT INTO news_articles (
        title, slug, excerpt, content, cover_image_url, media_urls, category, tags,
        author_name, author_type, organization_id, state, lga, status, published_at
      ) VALUES (
        ${title}, ${slug}, ${excerpt}, ${content},
        ${null}, ${JSON.stringify([])},
        ${finalCategory}, ${JSON.stringify(tags)},
        ${authorName}, ${authorType}, ${organizationId},
        ${state}, ${lga}, ${status}, ${publishedAt}
      )
      RETURNING *
    `) as unknown as any[];

    const row = rows[0];
    return Response.json(
      {
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        content: row.content,
        category: row.category,
        tags: row.tags ? (typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags) : [],
        state: row.state,
        lga: row.lga,
        status: row.status,
        authorName: row.author_name,
        authorType: row.author_type,
        organizationId: row.organization_id,
        coverImageUrl: row.cover_image_url,
        mediaUrls: row.media_urls
          ? typeof row.media_urls === "string"
            ? JSON.parse(row.media_urls)
            : row.media_urls
          : [],
        publishedAt: row.published_at,
        createdAt: row.created_at,
        source,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[news/generate-publish] DB insert failed:", err);
    return Response.json(
      { message: "Failed to save generated article" },
      { status: 500 }
    );
  }
}
