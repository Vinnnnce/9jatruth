import { ensureDbInitialized, getDb } from "@/lib/db";
import { isKimiConfigured, generateKimiText } from "@/lib/kimi";

/**
 * POST /api/news/auto-summary
 * Triggers daily AI summary of all feeds/posts.
 * Auth: CRON_SECRET header OR admin email header
 */
export async function POST(request: Request) {
  await ensureDbInitialized();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = authHeader === `Bearer ${cronSecret}`;

  if (!isCronRequest) {
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    if (!adminEmail) {
      return Response.json({ message: "Admin email not configured" }, { status: 500 });
    }
    const callerEmail = request.headers.get("x-admin-email");
    if (callerEmail !== adminEmail) {
      return Response.json({ message: "Unauthorized" }, { status: 401 });
    }
  }

  const sql = getDb();
  return generateDailySummary(sql);
}

/**
 * GET /api/news/auto-summary
 * - With CRON_SECRET header: triggers daily summary (for Vercel cron)
 * - Without: checks if today's summary exists
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const sql = getDb();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCronRequest) {
    return generateDailySummary(sql);
  }

  // Status check
  const today = new Date().toISOString().split("T")[0];
  const slug = `daily-summary-${today}`;
  const rows = (await sql`
    SELECT id, title, slug, excerpt, published_at, view_count
    FROM news_articles WHERE slug = ${slug} AND status = 'published'
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ hasSummary: false, message: "No daily summary generated yet today." });
  }
  return Response.json({ hasSummary: true, summary: rows[0] });
}

// ─── Core summary generation ───

async function generateDailySummary(sql: any) {
  // 1. Fetch recent truths from last 24 hours
  const recentTruths = (await sql`
    SELECT mt.id, mt.content, mt.category, mt.trust_score, mt.created_at,
           mt.neighborhood_id, mt.user_hash,
           n.name as neighborhood_name, n.region, n.state, n.lga
    FROM micro_truths mt
    LEFT JOIN neighborhoods n ON mt.neighborhood_id = n.id
    WHERE mt.created_at >= NOW() - INTERVAL '24 hours' AND mt.status = 'active'
    ORDER BY mt.created_at DESC LIMIT 500
  `) as unknown as any[];

  if (recentTruths.length === 0) {
    return Response.json({ success: false, message: "No posts in the last 24 hours to summarize." });
  }

  // 2. Group by category
  const byCategory: Record<string, any[]> = {};
  for (const t of recentTruths) {
    const cat = t.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(t);
  }

  // 3. Build summary data for AI
  const summaryData = Object.entries(byCategory).map(([cat, items]) => {
    const topStates = Object.entries(
      items.reduce((acc: Record<string, number>, t) => {
        const s = t.state || "Unknown";
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => `${s} (${c})`).join(", ");

    return {
      category: cat,
      count: items.length,
      topStates,
      sampleReports: items.slice(0, 10).map((t) => ({
        content: t.content.slice(0, 200),
        trustScore: t.trust_score,
        neighborhood: t.neighborhood_name,
        state: t.state,
        lga: t.lga,
      })),
    };
  });

  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // 4. Generate AI summary (or fallback to template)
  const systemPrompt = `You are an expert Nigerian news editor for the Soke platform. You write clear, engaging, and accurate news summaries from citizen reports. You structure articles with a headline, summary, and categorized sections. You use HTML formatting for the article body.`;

  const userPrompt = `Today is ${today}. Below is a summary of ${recentTruths.length} citizen reports from the last 24 hours on the Soke platform:

${JSON.stringify(summaryData, null, 2)}

Create a comprehensive daily news summary article. Respond as JSON:
{
  "title": "Compelling headline",
  "excerpt": "2-3 sentence summary",
  "content": "Full HTML article with <h2> sections, <p> paragraphs, <strong> emphasis",
  "tags": ["daily-summary", ...relevant tags],
  "category": "most prominent category or 'general'"
}

Base your summary ONLY on the data provided. Do not invent information. Highlight the most impactful stories. Include specific locations.`;

  let articleData: { title: string; excerpt: string; content: string; tags: string[]; category: string };

  if (isKimiConfigured()) {
    const aiResponse = await generateKimiText(systemPrompt, userPrompt, { temperature: 0.5, maxOutputTokens: 4096 });
    if (aiResponse) {
      let cleaned = aiResponse.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      }
      const fb = cleaned.indexOf("{");
      const lb = cleaned.lastIndexOf("}");
      if (fb !== -1 && lb !== -1) cleaned = cleaned.substring(fb, lb + 1);
      try {
        articleData = JSON.parse(cleaned);
      } catch {
        articleData = buildTemplateSummary(recentTruths, summaryData, today);
      }
    } else {
      articleData = buildTemplateSummary(recentTruths, summaryData, today);
    }
  } else {
    articleData = buildTemplateSummary(recentTruths, summaryData, today);
  }

  // 5. Save as news article
  const slug = `daily-summary-${new Date().toISOString().split("T")[0]}`;
  const existing = (await sql`SELECT id FROM news_articles WHERE slug = ${slug}`) as unknown as any[];

  if (existing.length > 0) {
    await sql`
      UPDATE news_articles SET
        title = ${articleData.title}, excerpt = ${articleData.excerpt},
        content = ${articleData.content},
        tags = ${JSON.stringify(articleData.tags || ["daily-summary"])},
        category = ${articleData.category || "general"}, updated_at = NOW()
      WHERE slug = ${slug}
    `;
    return Response.json({
      success: true, message: "Daily summary updated", slug,
      articleId: existing[0].id, postsSummarized: recentTruths.length,
      source: isKimiConfigured() ? "ai" : "template",
    });
  }

  const insertResult = (await sql`
    INSERT INTO news_articles (
      title, slug, excerpt, content, cover_image_url, media_urls,
      category, tags, author_name, author_type,
      organization_id, state, lga, status, is_verified,
      verification_badge, trust_score, view_count, like_count,
      comment_count, accuracy_bonus, published_at, created_at, updated_at
    ) VALUES (
      ${articleData.title}, ${slug}, ${articleData.excerpt}, ${articleData.content},
      NULL, ${JSON.stringify([])}, ${articleData.category || "general"},
      ${JSON.stringify(articleData.tags || ["daily-summary"])},
      'Soke AI Daily Digest', 'system',
      NULL, 'All', 'All',
      'published', TRUE, 'ai-verified', 100, 0, 0, 0, 0, NOW(), NOW(), NOW()
    ) RETURNING id
  `) as unknown as any[];

  return Response.json({
    success: true, message: "Daily summary created", slug,
    articleId: insertResult[0]?.id, postsSummarized: recentTruths.length,
    source: isKimiConfigured() ? "ai" : "template",
  });
}

// ─── Template-based fallback ───

function buildTemplateSummary(
  truths: any[],
  summaryData: { category: string; count: number; topStates: string; sampleReports: any[] }[],
  today: string
): { title: string; excerpt: string; content: string; tags: string[]; category: string } {
  const totalReports = truths.length;
  const categories = summaryData.map((s) => s.category).join(", ");
  const topCategory = summaryData.sort((a, b) => b.count - a.count)[0];

  const title = `Soke Daily Digest: ${totalReports} Citizen Reports Across Nigeria — ${today}`;
  const excerpt = `Today's summary covers ${totalReports} citizen reports. Most reported: ${topCategory?.category || "general"} (${topCategory?.count || 0} reports). Key areas: ${summaryData.map((s) => s.topStates).join("; ")}.`;

  let content = `<p><em>Generated automatically by Soke AI from citizen reports in the last 24 hours.</em></p>\n\n`;
  content += `<p><strong>${totalReports} reports</strong> were submitted across Nigeria today, covering ${categories}.</p>\n\n`;

  for (const cat of summaryData) {
    content += `<h2>${cat.category.charAt(0).toUpperCase() + cat.category.slice(1)} (${cat.count} reports)</h2>\n`;
    content += `<p>Top locations: ${cat.topStates}</p>\n<ul>\n`;
    for (const r of cat.sampleReports.slice(0, 5)) {
      content += `<li><strong>${r.neighborhood || "Unknown"}${r.state ? ", " + r.state : ""}</strong>: ${r.content} <em>(Trust: ${r.trustScore}%)</em></li>\n`;
    }
    content += `</ul>\n\n`;
  }
  content += `<p><em>This summary was generated automatically from citizen-submitted reports.</em></p>`;

  return { title, excerpt, content, tags: ["daily-summary", "citizen-reports", "automated"], category: topCategory?.category || "general" };
}
