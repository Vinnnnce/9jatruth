import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isKimiConfigured, generateKimiText } from "@/lib/kimi";

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

  // Generate AI comparison
  let aiAnalysis: string | null = null;

  if (isKimiConfigured()) {
    const systemPrompt = `You are a neighborhood comparison analyst for 9jatruth, a community truth platform. Compare two neighborhoods side-by-side based on their live conditions and metrics. Provide:
1. Overall comparison summary (which neighborhood is better overall and why)
2. Category-by-category breakdown (Power, Fuel, Traffic, Prices, Safety)
3. Risk assessment for each neighborhood
4. Recommendation: which area is safer/more livable
Keep the analysis under 400 words and be specific with numbers.`;

    const userPrompt = `Compare these two neighborhoods:

Neighborhood A: ${JSON.stringify(dataA, null, 2)}

Neighborhood B: ${JSON.stringify(dataB, null, 2)}

Provide a detailed side-by-side comparison.`;

    try {
      aiAnalysis = await generateKimiText(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxOutputTokens: 800,
      });
    } catch (err) {
      console.error("[Compare AI] Analysis failed:", err);
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
    aiPowered: !!aiAnalysis,
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
