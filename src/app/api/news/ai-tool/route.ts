import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isAiConfigured, generateAiJson, generateAiText } from "@/lib/ai-providers";

/**
 * POST /api/news/ai-tool
 * Runs an advanced AI helper on the current article draft using the
 * Deepseek + Kimi K3 ensemble (Deepseek primary, Kimi fallback).
 *
 * Body: {
 *   tool: "key_points" | "fact_check" | "auto_tag" | "seo" | "expand" | "translate",
 *   title: string, excerpt: string, content: string (HTML), lang?: string
 * }
 *
 * Returns a tool-specific JSON payload + the AI source used.
 */
export async function POST(request: Request) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const ip = getClientIP(request);
  const rl = rateLimit(`news-ai-tool:${ip}`, 20, 60_000);
  if (rl) return rl;

  const body = await request.json().catch(() => null);
  if (!body?.tool) {
    return Response.json({ message: "tool is required" }, { status: 400 });
  }

  const tool = String(body.tool) as
    | "key_points" | "fact_check" | "auto_tag" | "seo" | "expand" | "translate";
  const title = String(body.title || "").slice(0, 300);
  const excerpt = String(body.excerpt || "").slice(0, 600);
  // Strip HTML tags to plain text for the AI prompt (keeps token usage low).
  const contentText = String(body.content || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);

  if (!contentText && !title) {
    return Response.json({ message: "Article content is empty" }, { status: 400 });
  }

  if (!isAiConfigured()) {
    return Response.json(
      { message: "AI is not configured. Set DEEPSEEK_API_KEY or MOONSHOT_API_KEY." },
      { status: 503 }
    );
  }

  const draft = `Title: ${title || "(untitled)"}\nExcerpt: ${excerpt || "(none)"}\nContent: ${contentText || "(empty)"}`;
  const lang = String(body.lang || "Hausa");

  try {
    switch (tool) {
      case "key_points": {
        const { data, source } = await generateAiJson(
          "You are an editorial assistant for 9jatruth, a Nigerian news platform. Extract the most important key points from the article.",
          `Extract 3-6 key points as a JSON object: { "points": ["...", "..."] }.\n\nArticle:\n${draft}`,
          { points: [] as string[] },
          { temperature: 0.2, maxOutputTokens: 800 }
        );
        return Response.json({ tool, points: data.points ?? [], source });
      }
      case "fact_check": {
        const { data, source } = await generateAiJson(
          "You are a fact-checker for 9jatruth. Identify verifiable claims in the article and assess them. Be cautious and flag uncertainty.",
          `Return JSON: { "claims": [{ "claim": "...", "verdict": "verified"|"unverified"|"likely_false", "note": "short justification" }] }. Use 0-5 claims.\n\nArticle:\n${draft}`,
          { claims: [] as any[] },
          { temperature: 0.2, maxOutputTokens: 900 }
        );
        return Response.json({ tool, claims: data.claims ?? [], source });
      }
      case "auto_tag": {
        const { data, source } = await generateAiJson(
          "You are an SEO/editorial assistant for 9jatruth. Suggest relevant tags for the article.",
          `Return JSON: { "tags": ["lowercase", "single-word-or-kebab", ...] }. 3-8 tags. Choose from themes like elections, economy, security, infrastructure, innovation, agriculture, education, energy, sports, culture when relevant.\n\nArticle:\n${draft}`,
          { tags: [] as string[] },
          { temperature: 0.3, maxOutputTokens: 400 }
        );
        return Response.json({ tool, tags: data.tags ?? [], source });
      }
      case "seo": {
        const { data, source } = await generateAiJson(
          "You are an SEO specialist for 9jatruth. Optimize metadata for the article.",
          `Return JSON: { "metaTitle": "max 60 chars", "metaDescription": "max 160 chars", "slug": "url-friendly-slug", "keywords": ["..."] }.\n\nArticle:\n${draft}`,
          { metaTitle: "", metaDescription: "", slug: "", keywords: [] as string[] },
          { temperature: 0.3, maxOutputTokens: 600 }
        );
        return Response.json({ tool, seo: data, source });
      }
      case "expand": {
        const textRes = await generateAiText(
          "You are a journalist for 9jatruth. Expand the article with additional context, background, and analysis. Return only the new paragraphs in plain text (no markdown headings).",
          `Expand this article with 2-4 additional paragraphs of relevant context and analysis:\n\n${draft}`,
          { temperature: 0.5, maxOutputTokens: 1000 }
        );
        const html = (textRes.text || "")
          .split(/\n\n+/)
          .map((p) => `<p>${p.replace(/</g, "&lt;").trim()}</p>`)
          .join("");
        return Response.json({ tool, content: html, source: textRes.source });
      }
      case "translate": {
        const textRes = await generateAiText(
          `You are a translator for 9jatruth. Translate the article into ${lang}. Preserve meaning and tone. Return only the translated text (no markdown).`,
          `Translate into ${lang}:\n\n${draft}`,
          { temperature: 0.3, maxOutputTokens: 1200 }
        );
        const html = (textRes.text || "")
          .split(/\n\n+/)
          .map((p) => `<p>${p.replace(/</g, "&lt;").trim()}</p>`)
          .join("");
        return Response.json({ tool, content: html, language: lang, source: textRes.source });
      }
      default:
        return Response.json({ message: `Unknown tool: ${tool}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[news/ai-tool] failed:", err);
    return Response.json(
      { message: err?.message || "AI tool failed", aiConfigured: isAiConfigured() },
      { status: 500 }
    );
  }
}
