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
  /** True when NEWS_API_KEY is not set in the environment. */
  notConfigured?: boolean;
  /** NewsAPI status code from the last failing response, if any. */
  lastErrorCode?: string;
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
 *
 * NOTE: this only returns the articles. If you need the failure reason
 * (missing key, NewsAPI error code, network error), use
 * `fetchNewsFromApiWithStatus` instead.
 */
export async function fetchNewsFromApi(
  category?: string
): Promise<NewsApiArticle[]> {
  return (await fetchNewsFromApiWithStatus(category)).articles;
}

export interface FetchResult {
  articles: NewsApiArticle[];
  /** Set when NEWS_API_KEY is missing or empty. */
  notConfigured: boolean;
  /** Human-readable error when the fetch failed. */
  error?: string;
  /** NewsAPI error code (e.g. "apiKeyInvalid", "rateLimited", "parametersIncorrect"). */
  errorCode?: string;
}

/**
 * Same as fetchNewsFromApi, but also returns why it failed so the cron job can
 * surface actionable diagnostics instead of silently reporting 0 fetched.
 */
export async function fetchNewsFromApiWithStatus(
  category?: string
): Promise<FetchResult> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.error("[news-external] NEWS_API_KEY is not set — skipping fetch");
    return { articles: [], notConfigured: true };
  }

  // Validate category if provided
  if (category && !VALID_CATEGORIES.includes(category as NewsCategory)) {
    const msg = `Invalid category "${category}" — skipping fetch`;
    console.warn(`[news-external] ${msg}`);
    return { articles: [], notConfigured: false, error: msg, errorCode: "invalidCategory" };
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
      // NewsAPI returns 426 on the free tier when called from a non-localhost
      // (production) origin, and 401/403 for a bad/missing key. Surface the
      // status so the cron summary explains *why* nothing was stored.
      const msg = `NewsAPI returned ${res.status} ${res.statusText}`;
      console.error(`[news-external] ${msg}`);
      return {
        articles: [],
        notConfigured: false,
        error: msg,
        errorCode: `http${res.status}`,
      };
    }

    const data = (await res.json()) as NewsApiResponse;

    if (data.status !== "ok") {
      const msg = `NewsAPI error: ${data.code ?? "unknown"} — ${data.message ?? "no message"}`;
      console.error(`[news-external] ${msg}`);
      return {
        articles: [],
        notConfigured: false,
        error: msg,
        errorCode: data.code,
      };
    }

    return { articles: data.articles ?? [], notConfigured: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[news-external] Failed to fetch news: ${msg}`);
    return { articles: [], notConfigured: false, error: msg };
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
    const result = await fetchNewsFromApiWithStatus();
    summary.fetched += result.articles.length;
    const count = await storeNewsArticles(result.articles, "general");
    summary.stored += count;
    if (!summary.categories.includes("general")) {
      summary.categories.push("general");
    }
    if (result.notConfigured) summary.notConfigured = true;
    if (result.error) {
      summary.errors.push(`top-headlines: ${result.error}`);
      if (result.errorCode) summary.lastErrorCode = result.errorCode;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`top-headlines: ${msg}`);
  }

  // 2. Fetch each category
  for (const category of VALID_CATEGORIES) {
    try {
      const result = await fetchNewsFromApiWithStatus(category);
      summary.fetched += result.articles.length;
      const count = await storeNewsArticles(result.articles, category);
      summary.stored += count;
      if (!summary.categories.includes(category)) {
        summary.categories.push(category);
      }
      if (result.notConfigured) summary.notConfigured = true;
      if (result.error) {
        summary.errors.push(`${category}: ${result.error}`);
        if (result.errorCode) summary.lastErrorCode = result.errorCode;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${category}: ${msg}`);
    }
  }

  return summary;
}
