import { ensureDbInitialized } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/rate-limiter";
import {
  getStates,
  getParties,
  getParty,
  getResults,
  getStateResults,
  getOutliers,
  getGeoIdForState,
} from "@/lib/nigeria2";

/**
 * GET /api/politics/nigeria2?resource=states|parties|party|results|state-results|outliers
 * Server-side proxy for the Nigeria 2.0 open election API. Keeps the public API
 * off the client (CORS, caching, rate-limiting handled here).
 *
 * Nigeria2 data is "evidence" (transcription of INEC result sheets), not an
 * official count — the UI labels it as such.
 */
export async function GET(request: Request) {
  await ensureDbInitialized();
  const ip = getClientIP(request);
  const rl = rateLimit(`nigeria2:${ip}`, 60, 60_000);
  if (rl) return rl;

  const { searchParams } = new URL(request.url);
  const resource = (searchParams.get("resource") || "").toLowerCase();

  try {
    switch (resource) {
      case "states":
        return Response.json(await getStates());
      case "parties":
        return Response.json(await getParties(searchParams.get("active") !== "false"));
      case "party": {
        const acronym = searchParams.get("acronym") || "";
        if (!acronym) return Response.json({ message: "acronym required" }, { status: 400 });
        return Response.json(await getParty(acronym));
      }
      case "results": {
        const year = Number(searchParams.get("year"));
        if (![2019, 2023].includes(year)) return Response.json({ message: "year must be 2019 or 2023" }, { status: 400 });
        return Response.json(await getResults(year));
      }
      case "state-results": {
        const year = Number(searchParams.get("year"));
        let geoId = searchParams.get("geo_id") || "";
        const state = searchParams.get("state");
        if (!geoId && state) geoId = (await getGeoIdForState(state)) || "";
        if (![2019, 2023].includes(year) || !geoId) return Response.json({ message: "valid year + geo_id/state required" }, { status: 400 });
        return Response.json(await getStateResults(year, geoId));
      }
      case "outliers": {
        const year = Number(searchParams.get("year"));
        if (![2019, 2023].includes(year)) return Response.json({ message: "year must be 2019 or 2023" }, { status: 400 });
        return Response.json(await getOutliers(year, {
          state: searchParams.get("state") || undefined,
          office: searchParams.get("office") || undefined,
          rule: searchParams.get("rule") || undefined,
          limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
          offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : undefined,
        }));
      }
      default:
        return Response.json({ message: "Unknown resource. Use states|parties|party|results|state-results|outliers" }, { status: 400 });
    }
  } catch (err: any) {
    return Response.json({ message: err?.message || "Nigeria2 fetch failed" }, { status: 502 });
  }
}
