import { getAgencyBySlug, EmergencyAgency } from "@/lib/emergency-agencies";
import { generateKimiText, isKimiConfigured } from "@/lib/kimi";

export const runtime = "nodejs";

function fallbackBriefing(agency: EmergencyAgency): { briefing: string; steps: string[] } {
  return {
    briefing: `${agency.name} (${agency.shortName}) is ${agency.description.toLowerCase()} Reach them on ${agency.phonePrimary}, Nigeria's national emergency number, which routes to the nearest response centre. ${agency.jurisdiction}.`,
    steps: [
      `Call ${agency.phonePrimary} immediately and state your exact location (state, LGA, nearest landmark).`,
      "Stay calm and speak clearly; give your name and a concise description of the incident.",
      "Do not endanger yourself to gather information — safety first.",
      "Remain on the line and follow the operator's instructions until help arrives.",
    ],
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const agency = slug ? getAgencyBySlug(slug) : undefined;

  if (!agency) {
    return Response.json({ error: "Unknown agency" }, { status: 404 });
  }

  // Advanced AI-driven briefing using Kimi (Moonshot) with graceful fallback.
  if (isKimiConfigured()) {
    try {
      const system =
        "You are a Nigerian public-safety assistant integrated into the 9jatruth platform. " +
        "Produce a concise, actionable safety briefing for the requested agency. " +
        "Keep it under 90 words, calm and practical. Never invent phone numbers or addresses — " +
        "only use the details provided in the user prompt. End with a short list of 3-5 recommended actions.";
      const user = `Agency: ${agency.name} (${agency.shortName})\n` +
        `Category: ${agency.category}\n` +
        `Emergency line: ${agency.phonePrimary}\n` +
        `Office line: ${agency.phoneSecondary ?? "n/a"}\n` +
        `National HQ: ${agency.address}\n` +
        `Jurisdiction: ${agency.jurisdiction}\n` +
        `Core services: ${agency.services.join(", ")}\n` +
        `Description: ${agency.description}\n\n` +
        `Generate a context-aware safety briefing and 3-5 recommended actions for a citizen who needs to engage or reach this agency.`;

      const text = await generateKimiText(system, user, { temperature: 0.5, maxOutputTokens: 512 });

      if (text) {
        // Try to split briefing from action list; if the model used numbered/bulleted lines.
        const steps = extractSteps(text);
        const briefing = steps.length > 0 ? stripSteps(text) : text;
        return Response.json({ briefing: briefing.trim(), steps, source: "ai" as const });
      }
    } catch (err) {
      console.error("[agency-briefing] AI error:", err);
    }
  }

  const fb = fallbackBriefing(agency);
  return Response.json({ ...fb, source: "static" as const });
}

/** Pull trailing numbered/bulleted action lines out of an AI response. */
function extractSteps(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const steps: string[] = [];
  for (const line of lines) {
    const m = line.match(/^[-•*\d]+[.)]?\s+(.+)/);
    if (m) steps.push(m[1]);
  }
  return steps.slice(-5);
}

function stripSteps(text: string): string {
  const lines = text.split("\n");
  const cutoff = lines.findIndex((l) => /^[-•*\d]+[.)]?\s+/.test(l.trim()));
  return cutoff === -1 ? text : lines.slice(0, cutoff).join(" ").trim();
}
