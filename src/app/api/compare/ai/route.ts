import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isAiConfigured, generateAiJson, generateAiText } from "@/lib/ai-providers";

/**
 * POST /api/compare/ai
 * Runs AI-powered side-by-side comparison of two neighborhoods.
 * Uses Kimi K3 to analyze live conditions and metrics.
 *
 * Body: { neighborhoodA: number, neighborhoodB: number }
 */
export async function POST(request: Request) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const ip = getClientIP(request);
  const rateLimitResponse = rateLimit(`compare-ai:${ip}`, 15, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  await ensureDbInitialized();

  const body = await request.json().catch(() => null);
  if (!body?.neighborhoodA || !body?.neighborhoodB) {
    return Response.json({ message: "neighborhoodA and neighborhoodB required" }, { status: 400 });
  }

  const sql = getDb();

  // Fetch data for both neighborhoods
  const rows = (await sql`
    SELECT n.id, n.name, n.region, n.lat, n.lng,
      s.power_status, s.fuel_status, s.traffic_level,
      s.price_index, s.safety_index, s.active_truths,
      COUNT(DISTINCT t.id) as truth_count,
      AVG(t.trust_score) as avg_trust
    FROM neighborhoods n
    LEFT JOIN snapshots s ON s.neighborhood_id = n.id
    LEFT JOIN micro_truths t ON t.neighborhood_id = n.id AND t.status != 'rejected'
    WHERE n.id IN (${body.neighborhoodA}, ${body.neighborhoodB})
    GROUP BY n.id, n.name, n.region, n.lat, n.lng, s.power_status, s.fuel_status, s.traffic_level, s.price_index, s.safety_index, s.active_truths
  `) as unknown as any[];

  if (rows.length < 2) {
    return Response.json({ message: "Could not find both neighborhoods" }, { status: 404 });
  }

  const neighborhoodA = rows.find(r => r.id === body.neighborhoodA) || rows[0];
  const neighborhoodB = rows.find(r => r.id === body.neighborhoodB) || rows[1];

  // Fetch recent truths for context
  const recentTruthsA = (await sql`
    SELECT category, content, trust_score, created_at FROM micro_truths
    WHERE neighborhood_id = ${body.neighborhoodA} AND status != 'rejected'
    ORDER BY created_at DESC LIMIT 5
  `) as unknown as any[];

  const recentTruthsB = (await sql`
    SELECT category, content, trust_score, created_at FROM micro_truths
    WHERE neighborhood_id = ${body.neighborhoodB} AND status != 'rejected'
    ORDER BY created_at DESC LIMIT 5
  `) as unknown as any[];

  const dataA = {
    name: neighborhoodA.name,
    region: neighborhoodA.region,
    power: neighborhoodA.power_status,
    fuel: neighborhoodA.fuel_status,
    traffic: neighborhoodA.traffic_level,
    priceIndex: neighborhoodA.price_index,
    safetyIndex: neighborhoodA.safety_index,
    activeTruths: neighborhoodA.active_truths,
    truthCount: neighborhoodA.truth_count,
    avgTrust: Number(neighborhoodA.avg_trust || 50).toFixed(1),
    recentTruths: recentTruthsA.map(t => ({ category: t.category, content: String(t.content).slice(0, 100), trustScore: t.trust_score })),
  };

  const dataB = {
    name: neighborhoodB.name,
    region: neighborhoodB.region,
    power: neighborhoodB.power_status,
    fuel: neighborhoodB.fuel_status,
    traffic: neighborhoodB.traffic_level,
    priceIndex: neighborhoodB.price_index,
    safetyIndex: neighborhoodB.safety_index,
    activeTruths: neighborhoodB.active_truths,
    truthCount: neighborhoodB.truth_count,
    avgTrust: Number(neighborhoodB.avg_trust || 50).toFixed(1),
    recentTruths: recentTruthsB.map(t => ({ category: t.category, content: String(t.content).slice(0, 100), trustScore: t.trust_score })),
  };

  // Generate AI comparison using the Deepseek + Kimi K3 ensemble (Deepseek
  // primary, Kimi fallback). Returns BOTH a structured analysis object and a
  // plain-text summary so the UI can render rich widgets and a readable report.
type AiCompareResult = {
    summary: string;
    verdict: string;
    winner: "a" | "b" | "tie";
    riskA: number;
    riskB: number;
    categories: { name: string; a: string; b: string; advantage: "a" | "b" | "tie" }[];
    recommendations: string[];
    confidence: number;
  };
  let aiAnalysis: string | null = null;
  let aiResult: AiCompareResult | null = null;
  let aiSource: "deepseek" | "kimi" | "fallback" | null = isAiConfigured() ? null : null;

  if (isAiConfigured()) {
    const systemPrompt = `You are a neighborhood comparison analyst for 9jatruth, a Nigerian community truth platform. Compare two neighborhoods side-by-side based on live conditions and metrics. Be specific with the numbers provided, objective, and practical for residents, businesses, and visitors.`;

    const userPrompt = `Compare these two neighborhoods and respond with ONLY a JSON object.

Neighborhood A (${dataA.name}, ${dataA.region}): ${JSON.stringify(dataA, null, 2)}

Neighborhood B (${dataB.name}, ${dataB.region}): ${JSON.stringify(dataB, null, 2)}

JSON schema:
{
  "summary": "2-3 sentence overall comparison",
  "verdict": "one short sentence naming the better neighborhood and why",
  "winner": "a" | "b" | "tie",
  "riskA": 0-100 (risk score for A, higher = riskier),
  "riskB": 0-100 (risk score for B, higher = riskier),
  "categories": [{ "name": "Power"|"Fuel"|"Traffic"|"Prices"|"Safety", "a": "short label for A", "b": "short label for B", "advantage": "a"|"b"|"tie" }],
  "recommendations": ["3-5 practical, actionable recommendations for residents/visitors"],
  "confidence": 0-100
}`;

    try {
      const { data, source } = await generateAiJson(
        systemPrompt,
        userPrompt,
        {
          summary: "AI comparison unavailable.",
          verdict: "Unable to determine a winner.",
          winner: "tie",
          riskA: 50,
          riskB: 50,
          categories: [],
          recommendations: [],
          confidence: 0,
        },
        { temperature: 0.3, maxOutputTokens: 1000 }
      );
      aiResult = data as AiCompareResult;
      aiSource = source;
      // Also produce a readable plain-text report for sharing / fallback UI.
      aiAnalysis = aiResult?.summary
        ? `${aiResult.summary}\n\nVerdict: ${aiResult.verdict}`
        : null;
    } catch (err) {
      console.error("[Compare AI] Structured analysis failed:", err);
      // Last-resort: plain text via the ensemble.
      try {
        const textRes = await generateAiText(
          "You are a neighborhood comparison analyst for 9jatruth.",
          `Compare these two Nigerian neighborhoods in under 200 words:\nA: ${JSON.stringify(dataA)}\nB: ${JSON.stringify(dataB)}`,
          { temperature: 0.3, maxOutputTokens: 600 }
        );
        aiAnalysis = textRes.text;
        aiSource = textRes.source;
      } catch {
        // give up gracefully
      }
    }
  }

  // Build metric deltas
  const metrics = [
    {
      metric: "Power",
      a: dataA.power || "unknown",
      b: dataB.power || "unknown",
      winner: compareStatus(dataA.power, dataB.power),
    },
    {
      metric: "Fuel",
      a: dataA.fuel || "unknown",
      b: dataB.fuel || "unknown",
      winner: compareStatus(dataA.fuel, dataB.fuel),
    },
    {
      metric: "Traffic",
      a: dataA.traffic || "unknown",
      b: dataB.traffic || "unknown",
      winner: compareStatus(dataA.traffic, dataB.traffic),
    },
    {
      metric: "Price Index",
      a: dataA.priceIndex ?? "N/A",
      b: dataB.priceIndex ?? "N/A",
      winner: (dataA.priceIndex ?? 999) < (dataB.priceIndex ?? 999) ? "a" : "b",
    },
    {
      metric: "Safety Index",
      a: dataA.safetyIndex ?? "N/A",
      b: dataB.safetyIndex ?? "N/A",
      winner: (dataA.safetyIndex ?? 0) > (dataB.safetyIndex ?? 0) ? "a" : "b",
    },
  ];

  return Response.json({
    neighborhoodA: dataA,
    neighborhoodB: dataB,
    metrics,
    aiAnalysis,
    aiResult,
    aiPowered: !!(aiResult || aiAnalysis),
    aiSource,
  });
}

function compareStatus(a: string | null, b: string | null, lowerIsBetter = false): string {
  if (!a || !b) return "tie";
  const good = ["on", "available", "low"];
  const bad = ["off", "unavailable", "gridlock"];
  const aScore = good.includes(a) ? 2 : bad.includes(a) ? 0 : 1;
  const bScore = good.includes(b) ? 2 : bad.includes(b) ? 0 : 1;
  if (lowerIsBetter) {
    return aScore > bScore ? "b" : aScore < bScore ? "a" : "tie";
  }
  return aScore > bScore ? "a" : aScore < bScore ? "b" : "tie";
}
