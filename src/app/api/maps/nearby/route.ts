import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import { isKimiConfigured, generateKimiText } from "@/lib/kimi";

/**
 * GET /api/maps/nearby
 * Fetches nearby businesses and services from Google Places API.
 * Categories: hotels, restaurants, petrol stations, police, hospitals,
 * pharmacies, chemists, supermarkets, banks, and more.
 *
 * Query params:
 * - lat: latitude
 * - lng: longitude
 * - radius: search radius in meters (default 3000, max 50000)
 * - category: specific category filter (optional)
 * - ai: if "true", also runs AI analysis on the results
 */
export async function GET(request: Request) {
  const ip = getClientIP(request);
  const rateLimitResponse = rateLimit(`maps-nearby:${ip}`, 20, 60_000);
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get("lat") || "");
  const lng = parseFloat(url.searchParams.get("lng") || "");
  const radius = Math.min(50000, Math.max(100, parseInt(url.searchParams.get("radius") || "3000")));
  const category = url.searchParams.get("category") || "all";
  const useAI = url.searchParams.get("ai") === "true";

  if (isNaN(lat) || isNaN(lng)) {
    return Response.json({ message: "Valid lat and lng required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) {
    return Response.json({
      message: "Google Maps API key not configured. Set GOOGLE_MAPS_SERVER_KEY in .env",
      places: [],
      configured: false,
    });
  }

  // Define place type mappings
  const categoryConfig: Record<string, { type: string; keyword?: string; label: string; icon: string }[]> = {
    all: [
      { type: "lodging", label: "Hotels", icon: "🏨" },
      { type: "restaurant", label: "Restaurants", icon: "🍽️" },
      { type: "gas_station", label: "Petrol Stations", icon: "⛽" },
      { type: "police", label: "Police Stations", icon: "🚔" },
      { type: "hospital", label: "Hospitals", icon: "🏥" },
      { type: "pharmacy", label: "Pharmacies", icon: "💊" },
      { type: "drugstore", label: "Chemists", icon: "🧪" },
      { type: "supermarket", label: "Supermarkets", icon: "🛒" },
      { type: "bank", label: "Banks", icon: "🏦" },
      { type: "shopping_mall", label: "Shopping Malls", icon: "🏬" },
      { type: "school", label: "Schools", icon: "🏫" },
      { type: "police", keyword: "security agency", label: "Security Agencies", icon: "🛡️" },
      { type: "police", keyword: "army barracks military base", label: "Army Barracks", icon: "🏛️" },
    ],
    hotels: [{ type: "lodging", label: "Hotels", icon: "🏨" }],
    restaurants: [{ type: "restaurant", label: "Restaurants", icon: "🍽️" }],
    fuel: [{ type: "gas_station", label: "Petrol Stations", icon: "⛽" }],
    police: [{ type: "police", label: "Police Stations", icon: "🚔" }],
    hospitals: [{ type: "hospital", label: "Hospitals", icon: "🏥" }],
    pharmacies: [{ type: "pharmacy", label: "Pharmacies", icon: "💊" }],
    supermarkets: [{ type: "supermarket", label: "Supermarkets", icon: "🛒" }],
  };

  const configs = categoryConfig[category] || categoryConfig.all;
  const allPlaces: any[] = [];

  // Fetch places for each category
  for (const config of configs) {
    try {
      const params = new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(radius),
        type: config.type,
        key: apiKey,
      });

      if (config.keyword) {
        params.set("keyword", config.keyword);
      }

      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) continue;

      const data = await res.json();

      if (data.results) {
        for (const place of data.results.slice(0, 10)) {
          allPlaces.push({
            id: place.place_id,
            name: place.name,
            category: config.label,
            icon: config.icon,
            lat: place.geometry?.location?.lat,
            lng: place.geometry?.location?.lng,
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            priceLevel: place.price_level,
            vicinity: place.vicinity,
            openNow: place.opening_hours?.open_now,
            types: place.types,
            distance: place.geometry?.location
              ? haversine(lat, lng, place.geometry.location.lat, place.geometry.location.lng)
              : null,
          });
        }
      }
    } catch (err) {
      console.error(`[Maps] Failed to fetch ${config.label}:`, err);
    }
  }

  // Sort by distance
  allPlaces.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

  // Optional AI analysis
  let aiAnalysis: string | null = null;
  if (useAI && isKimiConfigured() && allPlaces.length > 0) {
    const systemPrompt = `You are a location intelligence AI for Soke, a community platform. Analyze the nearby places data and provide insights about:
1. Safety assessment (proximity to police, hospitals, security)
2. Essential services availability (pharmacies, hospitals, fuel)
3. Commercial activity (restaurants, hotels, supermarkets)
4. Notable observations or risks
Keep the analysis concise (under 300 words) and actionable.`;

    const placesSummary = allPlaces.slice(0, 30).map(p => ({
      name: p.name,
      category: p.category,
      distance: p.distance ? `${p.distance.toFixed(0)}m` : "unknown",
      rating: p.rating,
      open: p.openNow,
      vicinity: p.vicinity,
    }));

    const userPrompt = `Analyze these nearby places around coordinates ${lat}, ${lng}:

${JSON.stringify(placesSummary, null, 2)}`;

    try {
      aiAnalysis = await generateKimiText(systemPrompt, userPrompt, {
        temperature: 0.3,
        maxOutputTokens: 512,
      });
    } catch (err) {
      console.error("[Maps] AI analysis failed:", err);
    }
  }

  return Response.json({
    places: allPlaces,
    total: allPlaces.length,
    aiAnalysis,
    configured: true,
  });
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
