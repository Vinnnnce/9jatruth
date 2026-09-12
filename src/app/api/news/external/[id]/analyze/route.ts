import { ensureDbInitialized, getDb } from "@/lib/db";
import { generateAiJson } from "@/lib/ai-providers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive().max(1_000_000),
});

interface AiAnalysisResult {
  summary: string;
  tags: string[];
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;
  takeaways: string[];
  regionTags: string[];
  keyEntities: string[];
  credibilityScore: number;
}

const FALLBACK_RESULT: AiAnalysisResult = {
  summary: "",
  tags: [],
  sentiment: "neutral",
  sentimentScore: 0,
  takeaways: [],
  regionTags: [],
  keyEntities: [],
  credibilityScore: 50,
};

/**
 * POST /api/news/external/[id]/analyze — AI analysis of an external news article
 *
 * Generates:
 * - AI summary (concise 2-3 sentence overview)
 * - Tags (topical keywords)
 * - Sentiment (positive/negative/neutral + score)
 * - Key takeaways (bullet points)
 * - Region tags (Nigerian states/regions mentioned)
 * - Key entities (people, organizations, places)
 * - Credibility score (0-100, based on source + content quality)
 *
 * Results are cached in the news_external table (ai_* columns).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureDbInitialized();

  const resolvedParams = await params;
  const parsed = idParamSchema.safeParse(resolvedParams);

  if (!parsed.success) {
    return Response.json({ message: "Invalid article ID" }, { status: 400 });
  }

  const articleId = parsed.data.id;
  const sql = getDb();

  // Fetch the article
  const rows = (await sql`
    SELECT id, title, description, content, source_name, category, url,
           ai_summary, ai_tags, ai_sentiment, ai_takeaways, ai_region_tags,
           ai_key_entities, ai_source, ai_analyzed_at, ai_credibility_score
    FROM news_external WHERE id = ${articleId} LIMIT 1
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Article not found" }, { status: 404 });
  }

  const article = rows[0];

  // Return cached analysis if it exists and is less than 24 hours old
  if (article.ai_analyzed_at && article.ai_summary) {
    const analyzedAt = new Date(article.ai_analyzed_at);
    const ageMs = Date.now() - analyzedAt.getTime();
    if (ageMs < 24 * 60 * 60 * 1000) {
      return Response.json({
        ok: true,
        cached: true,
        analysis: {
          summary: article.ai_summary,
          tags: safeParseJson(article.ai_tags, []),
          sentiment: article.ai_sentiment || "neutral",
          takeaways: safeParseJson(article.ai_takeaways, []),
          regionTags: safeParseJson(article.ai_region_tags, []),
          keyEntities: safeParseJson(article.ai_key_entities, []),
          credibilityScore: article.ai_credibility_score || 50,
          source: article.ai_source || "ai",
        },
      });
    }
  }

  // Build the text for analysis
  const articleText = [
    article.title,
    article.description,
    article.content,
  ].filter(Boolean).join("\n\n").slice(0, 4000);

  if (!articleText) {
    return Response.json({ message: "No content to analyze" }, { status: 400 });
  }

  const systemPrompt = `You are an expert Nigerian news analyst AI for the 9jatruth platform. Analyze news articles and provide structured insights. You understand Nigerian geography, politics, and cultural context. Always respond with valid JSON.`;

  const userPrompt = `Analyze the following Nigerian news article and provide structured insights.

Title: ${article.title}
Source: ${article.source_name || "Unknown"}
Category: ${article.category}

Content:
${articleText}

Respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{
  "summary": "2-3 sentence concise summary of the article's key message",
  "tags": ["relevant", "topical", "keywords", "max 5 tags"],
  "sentiment": "positive" | "negative" | "neutral",
  "sentimentScore": -100 to 100,
  "takeaways": ["key takeaway 1", "key takeaway 2", "key takeaway 3"],
  "regionTags": ["Nigerian states or regions mentioned, e.g. Lagos, Abuja, FCT"],
  "keyEntities": ["people", "organizations", "institutions mentioned"],
  "credibilityScore": 0-100 based on source reputation and content quality
}

Base your analysis ONLY on the provided content. Do not invent information.`;

  const { data, source } = await generateAiJson<AiAnalysisResult>(
    systemPrompt,
    userPrompt,
    FALLBACK_RESULT,
    { temperature: 0.3, maxOutputTokens: 2048 }
  );

  // If AI returned a fallback (no provider configured), do a heuristic analysis
  let analysis = data;
  let analysisSource = source;

  if (source === "fallback") {
    analysis = heuristicAnalysis(article);
    analysisSource = "heuristic";
  }

  // Cache the result in the database
  try {
    await sql`
      UPDATE news_external SET
        ai_summary = ${analysis.summary || null},
        ai_tags = ${JSON.stringify(analysis.tags || [])},
        ai_sentiment = ${analysis.sentiment || null},
        ai_takeaways = ${JSON.stringify(analysis.takeaways || [])},
        ai_region_tags = ${JSON.stringify(analysis.regionTags || [])},
        ai_key_entities = ${JSON.stringify(analysis.keyEntities || [])},
        ai_source = ${analysisSource},
        ai_analyzed_at = NOW(),
        ai_credibility_score = ${analysis.credibilityScore || null}
      WHERE id = ${articleId}
    `;
  } catch (err) {
    console.error("[news/external/analyze] Failed to cache analysis:", err);
  }

  return Response.json({
    ok: true,
    cached: false,
    analysis: {
      ...analysis,
      source: analysisSource,
    },
  });
}

function safeParseJson(raw: any, fallback: any): any {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/** Fallback heuristic analysis when no AI provider is configured */
function heuristicAnalysis(article: any): AiAnalysisResult {
  const text = `${article.title || ""} ${article.description || ""} ${article.content || ""}`.toLowerCase();

  // Nigerian states for region tagging
  const nigerianStates = [
    "lagos", "abuja", "fct", "kano", "rivers", "oyọ", "oyo", "kaduna", "enugu",
    "anambra", "imo", "abia", "edo", "delta", "cross river", "akwa ibom",
    "benue", "plateau", "bauchi", "borno", "yobe", "adamawa", "taraba",
    "gombe", "nassarawa", "niger", "kwara", "osun", "ondo", "ekiti",
    "ogun", "sokoto", "kebbi", "zamfara", " jigawa", "jigawa", "katsina",
    "kogi", "ebonyi", "bayelsa",
  ];

  const regionTags = nigerianStates.filter((s) => text.includes(s));

  // Simple sentiment analysis
  const positiveWords = ["good", "great", "success", "progress", "improve", "win", "achieve", "positive", "growth", "development", "launch", "approved", "completed"];
  const negativeWords = ["bad", "crisis", "attack", "kill", "death", "fail", "corrupt", "protest", "strike", "violence", "crash", "collapse", "fraud", "arrest", "fire"];
  const positiveCount = positiveWords.filter((w) => text.includes(w)).length;
  const negativeCount = negativeWords.filter((w) => text.includes(w)).length;

  let sentiment: AiAnalysisResult["sentiment"] = "neutral";
  let sentimentScore = 0;
  if (positiveCount > negativeCount) {
    sentiment = "positive";
    sentimentScore = Math.min(100, positiveCount * 20);
  } else if (negativeCount > positiveCount) {
    sentiment = "negative";
    sentimentScore = -Math.min(100, negativeCount * 20);
  }

  // Extract potential entities (capitalized words)
  const entityRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
  const rawEntities = (article.title + " " + (article.description || "")).match(entityRegex) || [];
  const stopWords = new Set(["The", "This", "That", "A", "An", "In", "On", "At", "To", "For", "Of", "And", "But", "Or", "Nigeria", "Nigerian"]);
  const keyEntities = [...new Set(rawEntities)].filter((e) => !stopWords.has(e) && e.length > 2).slice(0, 5);

  // Generate tags from category and content
  const tags = [article.category || "general"];
  if (text.includes("government") || text.includes("president") || text.includes("minister")) tags.push("politics");
  if (text.includes("economy") || text.includes("market") || text.includes("naira") || text.includes("trade")) tags.push("economy");
  if (text.includes("security") || text.includes("military") || text.includes("police")) tags.push("security");

  // Credibility based on source
  const credibleSources = ["punch", "vanguard", "guardian", "premium times", "daily trust", "channels tv"];
  const sourceName = (article.source_name || "").toLowerCase();
  const credibilityScore = credibleSources.some((s) => sourceName.includes(s)) ? 75 : 50;

  // Simple summary (first 2 sentences of description)
  const descSentences = (article.description || article.title || "").split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
  const summary = descSentences.slice(0, 2).join(". ").trim() || article.title;

  // Generate takeaways
  const takeaways: string[] = [];
  if (article.title) takeaways.push(article.title);
  if (regionTags.length > 0) takeaways.push(`Reported from ${regionTags.slice(0, 3).join(", ")}`);
  if (sentiment !== "neutral") takeaways.push(`Article sentiment is ${sentiment}`);

  return {
    summary,
    tags: [...new Set(tags)].slice(0, 5),
    sentiment,
    sentimentScore,
    takeaways,
    regionTags,
    keyEntities,
    credibilityScore,
  };
}
