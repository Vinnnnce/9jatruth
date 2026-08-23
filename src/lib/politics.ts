import { ensureDbInitialized, getDb } from "@/lib/db";

/**
 * Shared politics query helper.
 *
 * Normalizes the user-facing `position` vocabulary to the `office` column values
 * stored on `political_candidates`:
 *   president / vice_president / governor / senate / house_of_rep /
 *   lga_chairman / councillor  →  presidential | governor | senate | house |
 *   lga_chairman | councillor
 *
 * Supports filtering by state_id (FK → states.id), state name, lga, ward, party,
 * record_type (incumbent|candidate|aspirant|nominee), election_year.
 */

const POSITION_MAP: Record<string, string[]> = {
  president: ["presidential"],
  vice_president: ["vice_president", "vice_presidential"],
  governor: ["governor"],
  senate: ["senate", "senatorial"],
  house_of_rep: ["house", "house_of_representatives", "representatives"],
  lga_chairman: ["lga_chairman", "lga chairman"],
  councillor: ["councillor", "councilor"],
};

export function normalizePosition(position?: string | null): string[] | null {
  if (!position) return null;
  const key = position.toLowerCase().replace(/[\s-]+/g, "_");
  return POSITION_MAP[key] ?? [position];
}

export async function queryPoliticians(opts: {
  stateId?: number | null;
  state?: string | null;
  position?: string | null;
  lga?: string | null;
  ward?: string | null;
  party?: string | null;
  recordType?: string | null; // incumbent | candidate | aspirant | nominee
  electionYear?: number | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}) {
  const sql = getDb();
  const limit = Math.min(opts.limit ?? 100, 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const offices = normalizePosition(opts.position);

  const rows = (await sql`
    SELECT c.*, p.name AS party_name, p.color AS party_color, p.logo_url AS party_logo,
           s.name AS state_name
    FROM political_candidates c
    LEFT JOIN political_parties p ON c.party_acronym = p.acronym
    LEFT JOIN states s ON s.name = c.state
    WHERE (${opts.stateId ?? null}::int IS NULL OR s.id = ${opts.stateId ?? null}::int)
      AND (${opts.state ?? null}::text IS NULL OR c.state ILIKE ${"%" + (opts.state ?? "") + "%"})
      AND (${opts.lga ?? null}::text IS NULL OR c.lga ILIKE ${"%" + (opts.lga ?? "") + "%"})
      AND (${opts.ward ?? null}::text IS NULL OR c.ward ILIKE ${"%" + (opts.ward ?? "") + "%"})
      AND (${opts.party ?? null}::text IS NULL OR c.party_acronym ILIKE ${"%" + (opts.party ?? "") + "%"})
      AND (${opts.recordType ?? null}::text IS NULL OR c.record_type = ${opts.recordType})
      AND (${opts.electionYear ?? null}::int IS NULL OR c.election_year = ${opts.electionYear})
      AND (${opts.search ?? null}::text IS NULL OR c.name ILIKE ${"%" + (opts.search ?? "") + "%"})
      AND (
        ${offices === null}::boolean OR
        c.office = ANY(${offices ? offices : []}::text[])
      )
    ORDER BY
      CASE c.office WHEN 'presidential' THEN 0 WHEN 'governor' THEN 1 WHEN 'senate' THEN 2
                   WHEN 'house' THEN 3 WHEN 'lga_chairman' THEN 4 WHEN 'councillor' THEN 5 ELSE 9 END,
      c.state NULLS FIRST, c.name
    LIMIT ${limit} OFFSET ${offset}`) as any;

  return rows ?? [];
}
