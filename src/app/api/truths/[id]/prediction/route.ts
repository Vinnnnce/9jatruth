import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isKimiConfigured, generateKimiText } from "@/lib/kimi";

/**
 * POST /api/truths/[id]/prediction
 * Generates an AI prediction for a specific truth/post.
 * Uses Kimi K3 to analyze the post and predict likely next conditions.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const ip = getClientIP(request);
  const rateLimitResponse = rateLimit(`prediction:${ip}`, 20, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  await ensureDbInitialized();
  const { id } = await params;
  const truthId = parseInt(id, 10);
  if (isNaN(truthId)) {
    return Response.json({ message: "Invalid truth ID" }, { status: 400 });
  }

  const sql = getDb();

  // Fetch the truth with neighborhood context
  const rows = (await sql`
    SELECT t.*, n.name as neighborhood_name, n.region,
      s.power_status, s.fuel_status, s.traffic_level, s.price_index, s.safety_index
    FROM micro_truths t
    LEFT JOIN neighborhoods n ON t.neighborhood_id = n.id
    LEFT JOIN snapshots s ON s.neighborhood_id = t.neighborhood_id
    WHERE t.id = ${truthId}
  `) as unknown as any[];

  if (rows.length === 0) {
    return Response.json({ message: "Truth not found" }, { status: 404 });
  }

  const truth = rows[0];

  // Get related truths in the same category for context
  const relatedRows = (await sql`
    SELECT content, trust_score, created_at FROM micro_truths
    WHERE neighborhood_id = ${truth.neighborhood_id}
      AND category = ${truth.category}
      AND status != 'rejected'
      AND id != ${truthId}
    ORDER BY created_at DESC
    LIMIT 5
  `) as unknown as any[];

  let prediction: string | null = null;
  let confidence = 0;
  let riskLevel = "low";
  let aiPowered = false;

  if (isKimiConfigured()) {
    const systemPrompt = `You are an AI prediction analyst for Soke, a community truth-reporting platform. Given a truth report and its context, predict:
1. What is the likely next condition (will it improve, worsen, or stay the same)?
2. What is the risk level (low, moderate, high)?
3. A confidence score (0-100)
4. A brief explanation (1-2 sentences)

Respond in this format:
Prediction: [your prediction]
Risk: [low/moderate/high]
Confidence: [0-100]
Explanation: [1-2 sentences]`;

    const userPrompt = `Analyze this truth report and predict the likely next condition:

Report: "${truth.content}"
Category: ${truth.category}
Trust Score: ${truth.trust_score}
Neighborhood: ${truth.neighborhood_name || "Unknown"}
Region: ${truth.region || "Unknown"}

Current conditions:
- Power: ${truth.power_status || "unknown"}
- Fuel: ${truth.fuel_status || "unknown"}
- Traffic: ${truth.traffic_level || "unknown"}
- Price Index: ${truth.price_index || "N/A"}
- Safety Index: ${truth.safety_index || "N/A"}%

Related recent reports in same category:
${relatedRows.map((r, i) => `${i + 1}. "${String(r.content).slice(0, 80)}" (trust: ${r.trust_score}%)`).join("\n") || "None"}`;

    try {
      prediction = await generateKimiText(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxOutputTokens: 256,
      });

      if (prediction) {
        const riskMatch = prediction.match(/risk:\s*(low|moderate|high)/i);
        const confMatch = prediction.match(/confidence:\s*(\d+)/i);

        if (riskMatch) riskLevel = riskMatch[1].toLowerCase();
        if (confMatch) confidence = parseInt(confMatch[1], 10);
        aiPowered = true;
      }
    } catch (err) {
      console.error("[AI Prediction] Kimi failed:", err);
    }
  }

  // Fallback heuristic prediction if AI is not available
  if (!prediction) {
    const category = truth.category;
    const isNegative = /\b(bad|worse|outage|unavailable|danger|broken|off|down|attack|crisis|scarcity)\b/i.test(truth.content);
    const isPositive = /\b(good|better|improved|restored|fixed|available|normal|safe)\b/i.test(truth.content);

    if (isNegative) {
      prediction = `Based on this ${category} report, conditions may worsen or remain unstable in the near term. Monitor for updates.`;
      riskLevel = "moderate";
      confidence = 55;
    } else if (isPositive) {
      prediction = `This ${category} report suggests improving conditions. Situation appears to be stabilizing.`;
      riskLevel = "low";
      confidence = 60;
    } else {
      prediction = `Insufficient signals to determine trend for this ${category} report. Monitor for corroborating reports.`;
      riskLevel = "low";
      confidence = 40;
    }
  }

  return Response.json({
    truthId,
    prediction,
    confidence,
    riskLevel,
    aiPowered,
    generatedAt: new Date().toISOString(),
  });
}
