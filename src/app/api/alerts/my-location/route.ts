import { getIpLocation } from "@/lib/api-helpers";
import { normalizeNigerianState } from "@/lib/emergency-agencies";

/**
 * GET /api/alerts/my-location
 * Public (no auth) — detects the caller's nearest Nigerian state from their
 * IP address so the Emergency Agencies Directory can surface nearby contacts
 * automatically instead of defaulting to FCT/Abuja.
 *
 * Returns { state, city, lat, lng, source }.
 * `source` is "ip" when a state was resolved from geolocation, otherwise
 * "fallback" (in which case `state` is null and the UI should show national
 * contacts or prompt the user to pick a state).
 */
export async function GET(request: Request) {
  try {
    const loc = await getIpLocation(request);

    const state = normalizeNigerianState(loc.ipRegion);
    const city = loc.ipCity || null;
    const lat = loc.ipLat ?? null;
    const lng = loc.ipLng ?? null;

    return Response.json(
      {
        state,
        city,
        lat,
        lng,
        rawRegion: loc.ipRegion || null,
        source: state ? "ip" : "fallback",
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[api/alerts/my-location] Error:", err);
    return Response.json(
      { state: null, city: null, lat: null, lng: null, source: "fallback" },
      { status: 200 }
    );
  }
}
