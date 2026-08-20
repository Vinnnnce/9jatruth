import { ensureDbInitialized, getDb } from "@/lib/db";

interface TriageRequest {
  description: string;
  state?: string;
  lga?: string;
  community?: string;
  village?: string;
  lat?: number;
  lng?: number;
}

// Agency matching rules — maps incident keywords to recommended agency types
const AGENCY_RULES: { keywords: string[]; agencyType: string; agencyName: string; severity: string; steps: string[] }[] = [
  {
    keywords: ["fire", "burn", "smoke", "explosion", "blast", "building collapse", "inferno"],
    agencyType: "fire_service",
    agencyName: "Fire Service",
    severity: "critical",
    steps: ["Evacuate the area immediately", "Call 112 or the nearest fire service", "Do not attempt to put out large fires yourself", "Alert neighbors and nearby buildings"],
  },
  {
    keywords: ["robbery", "rob", "attack", "assault", "fight", "violence", "stab", "shoot", "gun", "kidnap", "abduct", "thief", "thief", "burglary", "mugging"],
    agencyType: "police",
    agencyName: "Nigeria Police Force",
    severity: "critical",
    steps: ["Move to a safe location if possible", "Call 112 immediately", "Do not confront the attackers", "Note descriptions of suspects if safe to do so", "Wait for police arrival"],
  },
  {
    keywords: ["accident", "crash", "collision", "road accident", "vehicle", "car wreck", "hit and run"],
    agencyType: "road_safety",
    agencyName: "Federal Road Safety Corps (FRSC)",
    severity: "critical",
    steps: ["Call 112 for emergency services", "Do not move injured persons unless in danger", "Set up warning triangles if available", "Take photos for documentation", "Report to FRSC via 122"],
  },
  {
    keywords: ["drug", "narcotic", "cocaine", "heroin", "weed", "marijuana", "dealer", "substance abuse", "trafficking"],
    agencyType: "ndlea",
    agencyName: "National Drug Law Enforcement Agency (NDLEA)",
    severity: "warning",
    steps: ["Do not confront suspected drug dealers", "Note the location and any descriptions", "Call NDLEA hotline", "Report anonymously if needed"],
  },
  {
    keywords: ["fake drug", "counterfeit drug", "bad drug", "expired drug", "fake food", "fake medicine", "adulterated", "nafdac"],
    agencyType: "nafdac",
    agencyName: "NAFDAC",
    severity: "warning",
    steps: ["Stop using the product immediately", "Keep the product as evidence", "Report to NAFDAC via hotline", "Note the seller's details and location"],
  },
  {
    keywords: ["fraud", "scam", "corruption", "bribe", "embezzlement", "money laundering", "cybercrime", "yahoo", "419", "financial crime"],
    agencyType: "efcc",
    agencyName: "Economic and Financial Crimes Commission (EFCC)",
    severity: "warning",
    steps: ["Preserve all evidence (messages, receipts, bank details)", "Do not confront the fraudster", "Report to EFCC via hotline", "File a formal complaint with evidence"],
  },
  {
    keywords: ["riot", "protest", "unrest", "mob", "vandalism", "looting", "civil disturbance", "communal clash", "terrorism", "insurgent"],
    agencyType: "army",
    agencyName: "Nigerian Army",
    severity: "critical",
    steps: ["Stay indoors and lock all doors", "Avoid the affected area completely", "Call 112 for immediate assistance", "Monitor news for official updates", "Do not spread unverified information"],
  },
  {
    keywords: ["smuggling", "border", "import violation", "customs offense", "contraband", "illegal import"],
    agencyType: "customs",
    agencyName: "Nigeria Customs Service",
    severity: "warning",
    steps: ["Do not attempt to intercept smugglers", "Note vehicle details and direction of travel", "Call the Customs hotline", "Report location precisely"],
  },
  {
    keywords: ["medical emergency", "heart attack", "stroke", "collapse", "unconscious", "bleeding", "poison", "choking", "seizure", "breathing difficulty", "sick person"],
    agencyType: "hospital_emergency",
    agencyName: "Hospital Emergency Unit",
    severity: "critical",
    steps: ["Call 112 immediately for ambulance", "Keep the person calm and still", "Do not give food or water to unconscious person", "If trained, begin CPR if no pulse", "Prepare medical history for responders"],
  },
  {
    keywords: ["ambulance", "transport patient", "emergency transport", "medical evacuation", "rescue"],
    agencyType: "ambulance",
    agencyName: "Ambulance Service",
    severity: "critical",
    steps: ["Call 112 for ambulance dispatch", "Provide exact location landmarks", "Stay with the patient", "Clear access path for emergency vehicles"],
  },
  {
    keywords: ["intelligence", "threat", "security report", "suspicious activity", "espionage", "national security"],
    agencyType: "dss",
    agencyName: "Department of State Services (DSS)",
    severity: "warning",
    steps: ["Do not approach suspicious individuals", "Note descriptions and activities", "Call DSS hotline", "Keep information confidential"],
  },
  {
    keywords: ["vandalism", "destruction", "property damage", "public disturbance", "guard", "protection"],
    agencyType: "civil_defence",
    agencyName: "Nigeria Security and Civil Defence Corps (NSCDC)",
    severity: "warning",
    steps: ["Document the damage with photos", "Report to NSCDC via hotline", "Secure the area if safe", "File a formal report"],
  },
  {
    keywords: ["armed escort", "mobile police", "heavily armed", "tactical", "swat", "mopol", "mobile force"],
    agencyType: "mopol",
    agencyName: "Police Mobile Force (Mopol)",
    severity: "critical",
    steps: ["Call 112 for immediate dispatch", "Provide accurate location and threat details", "Evacuate civilians from the area", "Wait for tactical team arrival"],
  },
];

const SEVERITY_CONFIG = {
  critical: { color: "red", priority: 1, label: "Critical Emergency" },
  warning: { color: "amber", priority: 2, label: "Urgent — Report Needed" },
  info: { color: "blue", priority: 3, label: "Information" },
};

/**
 * POST /api/alerts/assess
 * AI-driven incident triage — accepts incident description + location,
 * returns severity, recommended agency, nearest contacts, and safety steps.
 */
export async function POST(request: Request) {
  await ensureDbInitialized();
  try {
    const body: TriageRequest = await request.json();
    const { description, state, lga, community } = body;

    if (!description || description.trim().length < 3) {
      return Response.json({ error: "Please provide a description of the incident" }, { status: 400 });
    }

    const descLower = description.toLowerCase();

    // Match against rules
    const matches = AGENCY_RULES.filter((rule) =>
      rule.keywords.some((kw) => descLower.includes(kw))
    );

    let recommendedAgency: typeof AGENCY_RULES[0] | null = null;
    let severity = "info";
    let safetySteps: string[] = [
      "Stay calm and assess the situation",
      "Call 112 for general emergencies",
      "Move to safety if in immediate danger",
      "Report to the nearest security agency",
    ];

    if (matches.length > 0) {
      // Pick the most specific match (longest keyword match)
      recommendedAgency = matches.reduce((best, current) => {
        const currentScore = current.keywords.filter(kw => descLower.includes(kw)).length;
        const bestScore = best.keywords.filter(kw => descLower.includes(kw)).length;
        return currentScore > bestScore ? current : best;
      });
      severity = recommendedAgency.severity;
      safetySteps = recommendedAgency.steps;
    }

    // Fetch nearest contacts for the recommended agency
    const sql = getDb();
    let contacts: any[] = [];

    if (recommendedAgency) {
      if (state && lga) {
        contacts = (await sql`
          SELECT * FROM emergency_contacts 
          WHERE agency_type = ${recommendedAgency.agencyType}
          AND (state = ${state} OR state IS NULL)
          ORDER BY 
            CASE WHEN state = ${state} AND lga = ${lga} THEN 0
                 WHEN state = ${state} THEN 1
                 ELSE 2 END,
            verified DESC
          LIMIT 5
        `) as unknown as any[];
      } else if (state) {
        contacts = (await sql`
          SELECT * FROM emergency_contacts 
          WHERE agency_type = ${recommendedAgency.agencyType}
          AND (state = ${state} OR state IS NULL)
          ORDER BY verified DESC
          LIMIT 5
        `) as unknown as any[];
      } else {
        contacts = (await sql`
          SELECT * FROM emergency_contacts 
          WHERE agency_type = ${recommendedAgency.agencyType}
          ORDER BY verified DESC, state NULLS FIRST
          LIMIT 5
        `) as unknown as any[];
      }
    }

    // Fetch general emergency contacts (police, fire, ambulance) as fallback
    const generalContacts = (await sql`
      SELECT * FROM emergency_contacts 
      WHERE agency_type IN ('police', 'fire_service', 'ambulance')
      AND (state = ${state ?? null} OR state IS NULL OR state = 'FCT')
      ORDER BY agency_type, verified DESC
      LIMIT 5
    `) as unknown as any[];

    const sevConfig = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;

    return Response.json({
      severity,
      severityLabel: sevConfig.label,
      recommendedAgency: recommendedAgency
        ? {
            type: recommendedAgency.agencyType,
            name: recommendedAgency.agencyName,
          }
        : null,
      safetySteps,
      contacts: contacts.map((c) => ({
        id: c.id,
        agencyType: c.agency_type,
        agencyName: c.agency_name,
        phonePrimary: c.phone_primary,
        phoneSecondary: c.phone_secondary,
        address: c.address,
        state: c.state,
        lga: c.lga,
        verified: c.verified,
      })),
      generalContacts: generalContacts.map((c) => ({
        id: c.id,
        agencyType: c.agency_type,
        agencyName: c.agency_name,
        phonePrimary: c.phone_primary,
        phoneSecondary: c.phone_secondary,
      })),
      aiAnalysis: await generateAIAnalysis(description, recommendedAgency, severity, state, lga),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/alerts/assess] Error:", err);
    return Response.json({
      severity: "info",
      severityLabel: "Information",
      recommendedAgency: null,
      safetySteps: ["Call 112 for general emergencies", "Stay calm and assess the situation"],
      contacts: [],
      generalContacts: [],
      aiAnalysis: "Unable to analyze the incident at this time. Please call 112 for immediate assistance.",
      timestamp: new Date().toISOString(),
    });
  }
}

async function generateAIAnalysis(
  description: string,
  agency: typeof AGENCY_RULES[0] | null,
  severity: string,
  state?: string,
  lga?: string
): Promise<string> {
  const location = state ? `${lga ? lga + ", " : ""}${state}` : "your location";

  // Advanced AI analysis via Kimi (Moonshot) when configured.
  try {
    const { isKimiConfigured, generateKimiText } = await import("@/lib/kimi");
    if (isKimiConfigured()) {
      const system =
        "You are a Nigerian public-safety assistant on the 9jatruth platform. " +
        "Given an incident description, produce a calm, concise (under 70 words) " +
        "analysis confirming severity, the recommended agency, and the most important " +
        "immediate action. Never invent phone numbers; the UI already shows contacts. " +
        "Do not use markdown.";
      const user = `Incident: "${description.slice(0, 200)}"\n` +
        `Severity: ${severity}\n` +
        `Recommended agency: ${agency?.agencyName ?? "unspecified"}\n` +
        `Location: ${location}`;
      const ai = await generateKimiText(system, user, { temperature: 0.4, maxOutputTokens: 320 });
      if (ai && ai.trim()) return ai.trim();
    }
  } catch (err) {
    console.error("[assess] AI analysis error:", err);
  }

  // Fallback — deterministic, rule-based analysis.
  if (!agency) {
    return `The incident description doesn't match a specific emergency category. If this is a life-threatening situation, call 112 immediately. For non-emergencies, consider contacting the Nigeria Police Force or Civil Defence Corps at ${location}.`;
  }

  const urgencyMap: Record<string, string> = {
    critical: "This is a CRITICAL emergency requiring immediate response.",
    warning: "This situation requires urgent attention. Report it promptly.",
    info: "This has been noted for your information.",
  };

  return `${urgencyMap[severity] || ""} Based on the description "${description.substring(0, 100)}${description.length > 100 ? "..." : ""}", the recommended agency is ${agency.agencyName}. ${severity === "critical" ? "Immediate action is required — do not delay in contacting emergency services." : "Please report this incident to the relevant authority at your earliest convenience."} ${location !== "your location" ? `Contacts for ${location} have been provided above.` : "National-level contacts have been provided."} Stay safe and follow the recommended safety steps.`;
}
