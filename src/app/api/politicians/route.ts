import { ensureDbInitialized } from "@/lib/db";
import { queryPoliticians } from "@/lib/politics";

/**
 * GET /api/politicians?state_id=&position=&lga=&ward=&party=&search=&limit=&offset=
 * Lists all politicians (incumbents + candidates + aspirants).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const stateId = searchParams.get("state_id") ? parseInt(searchParams.get("state_id")!, 10) : null;
  const position = searchParams.get("position");
  const lga = searchParams.get("lga");
  const ward = searchParams.get("ward");
  const party = searchParams.get("party");
  const search = searchParams.get("search");
  const limit = parseInt(searchParams.get("limit") || "100", 10) || 100;
  const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;

  const politicians = await queryPoliticians({ stateId, position, lga, ward, party, search, limit, offset });
  return Response.json({ politicians, count: politicians.length, filters: { stateId, position, lga, ward, party } });
}
