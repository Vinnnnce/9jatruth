import { ensureDbInitialized, getDb } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────────────

interface NewsApiArticle {
  source?: { id?: string | null; name?: string | null };
  author?: string | null;
  title?: string;
  description?: string | null;
  content?: string | null;
  url?: string;
  urlToImage?: string | null;
  publishedAt?: string | null;
}

interface NewsApiResponse {
  status?: string;
  totalResults?: number;
  articles?: NewsApiArticle[];
  code?: string;
  message?: string;
}

export interface StoredNewsArticle {
  id: number;
  source_name: string | null;
  author: string | null;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  published_at: string | null;
  category: string;
  created_at: string;
  is_audio_generated: boolean;
  audio_url: string | null;
}

export interface FetchSummary {
  fetched: number;
  stored: number;
  categories: string[];
  errors: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const NEWS_API_BASE = "https://newsapi.org/v2/top-headlines";
const NEWS_COUNTRY = "ng";

const VALID_CATEGORIES = [
  "business",
  "entertainment",
  "general",
  "health",
  "science",
  "sports",
  "technology",
] as const;

type NewsCategory = (typeof VALID_CATEGORIES)[number];

// ─── fetchNewsFromApi ───────────────────────────────────────────────────────

/**
 * Fetch Nigerian news from NewsAPI.org.
 * Returns an empty array on any error (never throws).
 */
export async function fetchNewsFromApi(
  category?: string
): Promise<NewsApiArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.error("[news-external] NEWS_API_KEY is not set — skipping fetch");
    return [];
  }

  // Validate category if provided
  if (category && !VALID_CATEGORIES.includes(category as NewsCategory)) {
    console.warn(
      `[news-external] Invalid category "${category}" — skipping fetch`
    );
    return [];
  }

  const params = new URLSearchParams({
    country: NEWS_COUNTRY,
    apiKey,
  });
  if (category) {
    params.set("category", category);
  }

  const url = `${NEWS_API_BASE}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "9jatruth/1.0" },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(
        `[news-external] NewsAPI returned ${res.status}: ${res.statusText}`
      );
      return [];
    }

    const data = (await res.json()) as NewsApiResponse;

    if (data.status !== "ok") {
      console.error(
        `[news-external] NewsAPI error: ${data.code ?? "unknown"} — ${
          data.message ?? "no message"
        }`
      );
      return [];
    }

    return data.articles ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[news-external] Failed to fetch news: ${msg}`);
    return [];
  }
}

// ─── storeNewsArticles ───────────────────────────────────────────────────────

/**
 * Insert articles into news_external with ON CONFLICT (url) DO NOTHING.
 * Maps NewsAPI fields to our schema. Returns count of newly inserted rows.
 */
export async function storeNewsArticles(
  articles: NewsApiArticle[],
  category: string
): Promise<number> {
  if (!articles || articles.length === 0) return 0;

  const sql = getDb();
  let inserted = 0;

  for (const article of articles) {
    // Skip articles without a URL (our UNIQUE constraint is on url)
    if (!article.url) continue;

    const sourceName = article.source?.name ?? null;
    const author = article.author ?? null;
    const title = article.title ?? null;
    const description = article.description ?? null;
    const content = article.content ?? null;
    const imageUrl = article.urlToImage ?? null;
    const publishedAt = article.publishedAt ?? null;

    // Skip if no title — a title is NOT NULL in the schema
    if (!title) continue;

    try {
      const result = (await sql`
        INSERT INTO news_external (
          source_name,
          author,
          title,
          description,
          content,
          url,
          image_url,
          published_at,
          category
        ) VALUES (
          ${sourceName},
          ${author},
          ${title},
          ${description},
          ${content},
          ${article.url},
          ${imageUrl},
          ${publishedAt ? new Date(publishedAt) : null},
          ${category}
        )
        ON CONFLICT (url) DO NOTHING
        RETURNING id
      `) as unknown as { id: number }[];

      if (result.length > 0) {
        inserted++;
      }
    } catch (err) {
      // Log but continue — don't let one bad article stop the rest
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[news-external] Failed to store article "${title.slice(0, 60)}": ${msg}`
      );
    }
  }

  return inserted;
}

// ─── generateAudio ───────────────────────────────────────────────────────────

/**
 * Generate an audio representation for an article.
 *
 * Since the serverless environment doesn't have a native TTS engine, we use
 * a hybrid approach:
 * 1. Fetch and clean the article text (strip HTML, truncate to ~3000 chars)
 * 2. Store the prepared text as a data URL in the audio_url field
 * 3. Mark is_audio_generated = true
 *
 * The client reads this data URL and uses the browser's SpeechSynthesis API
 * to convert the text to speech. This works cross-platform without any
 * external TTS API keys.
 *
 * If a TTS provider API key is configured (e.g. Google Cloud TTS, AWS Polly),
 * this function could be extended to call that API and store the resulting
 * audio file URL instead.
 */
export async function generateAudio(
  articleId: number
): Promise<{ audio_url: string } | null> {
  const sql = getDb();

  try {
    // Fetch the article content
    const rows = (await sql`
      SELECT id, title, description, content FROM news_external WHERE id = ${articleId} LIMIT 1
    `) as unknown as { id: number; title: string; description: string | null; content: string | null }[];

    if (rows.length === 0) {
      console.error(`[news-external] Article ${articleId} not found`);
      return null;
    }

    const article = rows[0];

    // Clean and prepare the text for TTS
    const rawText = [
      article.title,
      article.description,
      article.content,
    ]
      .filter(Boolean)
      .join(". ");

    // Strip HTML tags, decode common entities, and truncate
    const cleanText = rawText
      .replace(/<[^>]*>/g, "")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    if (!cleanText) {
      console.error(`[news-external] Article ${articleId} has no text content for TTS`);
      return null;
    }

    // Store the prepared text as a data URL that the client can use with SpeechSynthesis
    const audioUrl = `data:text/plain;base64,${Buffer.from(cleanText).toString("base64")}`;

    await sql`
      UPDATE news_external
      SET is_audio_generated = TRUE,
          audio_url = ${audioUrl}
      WHERE id = ${articleId}
    `;

    return { audio_url: audioUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[news-external] Failed to generate audio for article ${articleId}: ${msg}`
    );
    return null;
  }
}

// ─── fetchAndStoreAllNews ────────────────────────────────────────────────────

/**
 * Fetch top headlines + all category-specific headlines, store everything.
 * Called by the cron job. Never throws — returns a summary with errors[].
 */
export async function fetchAndStoreAllNews(): Promise<FetchSummary> {
  await ensureDbInitialized();

  const summary: FetchSummary = {
    fetched: 0,
    stored: 0,
    categories: [],
    errors: [],
  };

  // 1. Fetch top headlines (general, no category)
  try {
    const topArticles = await fetchNewsFromApi();
    summary.fetched += topArticles.length;
    const count = await storeNewsArticles(topArticles, "general");
    summary.stored += count;
    if (!summary.categories.includes("general")) {
      summary.categories.push("general");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`top-headlines: ${msg}`);
  }

  // 2. Fetch each category
  for (const category of VALID_CATEGORIES) {
    try {
      const articles = await fetchNewsFromApi(category);
      summary.fetched += articles.length;
      const count = await storeNewsArticles(articles, category);
      summary.stored += count;
      if (!summary.categories.includes(category)) {
        summary.categories.push(category);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${category}: ${msg}`);
    }
  }

  return summary;
}
