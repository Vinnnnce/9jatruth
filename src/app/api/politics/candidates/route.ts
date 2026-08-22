import { ensureDbInitialized, getDb } from "@/lib/db";
import { csrfCheck } from "@/lib/security";
import { requireSuperAdmin } from "@/lib/admin-auth";
import { getClerkUserId } from "@/lib/api-helpers";
import { z } from "zod";

/**
 * Political candidates & officeholders — full metadata for 2027 election + incumbents.
 * GET  /api/politics/candidates?office=&level=&state=&lga=&ward=&party=&year=&type=&search=  → list/filter
 * POST /api/politics/candidates (super-admin) → upsert candidate with full metadata
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureDbInitialized();
  const { searchParams } = new URL(request.url);
  const party = searchParams.get("party");
  const office = searchParams.get("office");
  const level = searchParams.get("level");
  const state = searchParams.get("state");
  const lga = searchParams.get("lga");
  const ward = searchParams.get("ward");
  const geoId = searchParams.get("geo_id");
  const year = searchParams.get("year");
  const type = searchParams.get("type"); // incumbent | candidate | aspirant | nominee
  const verified = searchParams.get("verified"); // unverified|pending|verified|disputed
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const sql = getDb();
  const rows = (await sql`
    SELECT c.*, p.name AS party_name, p.color AS party_color, p.logo_url AS party_logo
    FROM political_candidates c
    LEFT JOIN political_parties p ON c.party_acronym = p.acronym
    WHERE (${party ?? null}::text IS NULL OR c.party_acronym = ${party ?? null})
      AND (${office ?? null}::text IS NULL OR c.office = ${office ?? null})
      AND (${level ?? null}::text IS NULL OR c.office_level = ${level ?? null})
      AND (${state ?? null}::text IS NULL OR c.state ILIKE ${"%" + (state ?? "") + "%"})
      AND (${lga ?? null}::text IS NULL OR c.lga ILIKE ${"%" + (lga ?? "") + "%"})
      AND (${ward ?? null}::text IS NULL OR c.ward ILIKE ${"%" + (ward ?? "") + "%"})
      AND (${geoId ?? null}::text IS NULL OR c.geo_id = ${geoId ?? null})
      AND (${year ?? null}::int IS NULL OR c.election_year = ${year ?? null})
      AND (${type ?? null}::text IS NULL OR c.record_type = ${type ?? null})
      AND (${verified ?? null}::text IS NULL OR c.verification_status = ${verified ?? null})
      AND (${search ?? null}::text IS NULL OR c.name ILIKE ${"%" + (search ?? "") + "%"})
    ORDER BY
      CASE c.office WHEN 'presidential' THEN 0 WHEN 'governor' THEN 1 WHEN 'senate' THEN 2 WHEN 'house' THEN 3 WHEN 'lga_chairman' THEN 4 WHEN 'councillor' THEN 5 ELSE 9 END,
      c.state NULLS FIRST, c.name
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as any[];

  // total count for pagination
  const countRow = (await sql`
    SELECT COUNT(*)::int AS total FROM political_candidates c
    WHERE (${party ?? null}::text IS NULL OR c.party_acronym = ${party ?? null})
      AND (${office ?? null}::text IS NULL OR c.office = ${office ?? null})
      AND (${level ?? null}::text IS NULL OR c.office_level = ${level ?? null})
      AND (${state ?? null}::text IS NULL OR c.state ILIKE ${"%" + (state ?? "") + "%"})
      AND (${lga ?? null}::text IS NULL OR c.lga ILIKE ${"%" + (lga ?? "") + "%"})
      AND (${ward ?? null}::text IS NULL OR c.ward ILIKE ${"%" + (ward ?? "") + "%"})
      AND (${geoId ?? null}::text IS NULL OR c.geo_id = ${geoId ?? null})
      AND (${year ?? null}::int IS NULL OR c.election_year = ${year ?? null})
      AND (${type ?? null}::text IS NULL OR c.record_type = ${type ?? null})
      AND (${verified ?? null}::text IS NULL OR c.verification_status = ${verified ?? null})
      AND (${search ?? null}::text IS NULL OR c.name ILIKE ${"%" + (search ?? "") + "%"})
  `) as unknown as any[];

  return Response.json({ candidates: rows, total: countRow[0]?.total ?? rows.length, limit, offset });
}

// Helper: stringify JSON array fields safely
function jsonArr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return null; }
}

const candidateSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(2).max(200),
  party_acronym: z.string().max(20).optional().nullable(),
  office: z.enum(["presidential", "governor", "senate", "house", "lga_chairman", "councillor", "other"]),
  office_level: z.enum(["federal", "state", "lga"]).optional().nullable(),
  geo_id: z.string().max(30).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  lga: z.string().max(150).optional().nullable(),
  ward: z.string().max(150).optional().nullable(),
  senatorial_district: z.string().max(150).optional().nullable(),
  federal_constituency: z.string().max(150).optional().nullable(),
  state_constituency: z.string().max(150).optional().nullable(),
  election_year: z.number().int().min(1999).max(2030).optional().nullable(),
  record_type: z.enum(["incumbent", "candidate", "aspirant", "nominee", "unverified"]).optional().default("candidate"),
  gender: z.string().max(20).optional().nullable(),
  date_of_birth: z.string().max(40).optional().nullable(),
  place_of_birth: z.string().max(200).optional().nullable(),
  hometown: z.string().max(200).optional().nullable(),
  state_of_origin: z.string().max(100).optional().nullable(),
  local_govt_of_origin: z.string().max(150).optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  autobiography: z.string().max(10000).optional().nullable(),
  education_background: z.any().optional().nullable(),
  previous_political_positions: z.any().optional().nullable(),
  political_background: z.string().max(5000).optional().nullable(),
  businesses: z.any().optional().nullable(),
  business_interests: z.string().max(500).optional().nullable(),
  net_worth: z.string().max(200).optional().nullable(),
  assets_declared: z.any().optional().nullable(),
  health_status: z.string().max(500).optional().nullable(),
  health_disclosure_url: z.string().max(500).optional().nullable(),
  manifesto: z.string().max(10000).optional().nullable(),
  campaign_slogan: z.string().max(300).optional().nullable(),
  key_policies: z.any().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  facebook: z.string().max(300).optional().nullable(),
  twitter: z.string().max(300).optional().nullable(),
  instagram: z.string().max(300).optional().nullable(),
  linkedin: z.string().max(300).optional().nullable(),
  running_mate: z.string().max(200).optional().nullable(),
  incumbent_since: z.string().max(40).optional().nullable(),
  term_start: z.string().max(40).optional().nullable(),
  term_end: z.string().max(40).optional().nullable(),
  previous_party: z.string().max(100).optional().nullable(),
  criminal_record: z.any().optional().nullable(),
  corruption_allegations: z.any().optional().nullable(),
  court_cases: z.any().optional().nullable(),
  achievements: z.any().optional().nullable(),
  controversies: z.any().optional().nullable(),
  photo_url: z.string().max(1000).optional().nullable(),
  verification_status: z.enum(["unverified", "pending", "verified", "disputed"]).optional().default("unverified"),
  data_confidence: z.number().int().min(0).max(100).optional().nullable(),
  source_urls: z.any().optional().nullable(),
});

export async function POST(request: Request) {
  await ensureDbInitialized();
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const csrfError = csrfCheck(request);
  if (csrfError) return csrfError;

  const body = await request.json().catch(() => null);
  const parsed = candidateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ message: "Invalid candidate", errors: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const reviewedBy = (await getClerkUserId()) ?? "super-admin";
  const sql = getDb();

  const col = (v: any, fallback: any = null) => (v === undefined ? fallback : v);

  // If id provided and the row exists → UPDATE; otherwise → INSERT.
  const existing = d.id ? ((await sql`SELECT id FROM political_candidates WHERE id = ${d.id} LIMIT 1`) as unknown as any[]) : [];
  const isUpdate = existing.length > 0;

  const columns = `name, party_acronym, office, office_level, geo_id, state, lga, ward, senatorial_district, federal_constituency, state_constituency, election_year, record_type, gender, date_of_birth, place_of_birth, hometown, state_of_origin, local_govt_of_origin, bio, autobiography, education_background, previous_political_positions, political_background, businesses, business_interests, net_worth, assets_declared, health_status, health_disclosure_url, manifesto, campaign_slogan, key_policies, phone, email, website, facebook, twitter, instagram, linkedin, running_mate, incumbent_since, term_start, term_end, previous_party, criminal_record, corruption_allegations, court_cases, achievements, controversies, photo_url, verification_status, data_confidence, source_urls, updated_by, updated_at`;
  const values = [
    d.name, col(d.party_acronym), d.office, col(d.office_level), col(d.geo_id), col(d.state), col(d.lga), col(d.ward), col(d.senatorial_district), col(d.federal_constituency), col(d.state_constituency), col(d.election_year), col(d.record_type, "candidate"), col(d.gender), col(d.date_of_birth), col(d.place_of_birth), col(d.hometown), col(d.state_of_origin), col(d.local_govt_of_origin), col(d.bio), col(d.autobiography), jsonArr(d.education_background), jsonArr(d.previous_political_positions), col(d.political_background), jsonArr(d.businesses), col(d.business_interests), col(d.net_worth), jsonArr(d.assets_declared), col(d.health_status), col(d.health_disclosure_url), col(d.manifesto), col(d.campaign_slogan), jsonArr(d.key_policies), col(d.phone), col(d.email), col(d.website), col(d.facebook), col(d.twitter), col(d.instagram), col(d.linkedin), col(d.running_mate), col(d.incumbent_since), col(d.term_start), col(d.term_end), col(d.previous_party), jsonArr(d.criminal_record), jsonArr(d.corruption_allegations), jsonArr(d.court_cases), jsonArr(d.achievements), jsonArr(d.controversies), col(d.photo_url), col(d.verification_status, "unverified"), col(d.data_confidence), jsonArr(d.source_urls), reviewedBy, new Date(),
  ];

  // neon v1.x `sql` is tag-template-only; use sql.query for $1..$N binding with a params array.
  const query = (sql as any).query.bind(sql);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const result = isUpdate && d.id
    ? await query(`UPDATE political_candidates SET (${columns}) = ROW(${placeholders}) WHERE id = $${values.length + 1} RETURNING *`, [...values, d.id])
    : await query(`INSERT INTO political_candidates (${columns}) VALUES (${placeholders}) RETURNING *`, values);

  return Response.json({ candidate: result[0], action: isUpdate ? "updated" : "created" });
}
