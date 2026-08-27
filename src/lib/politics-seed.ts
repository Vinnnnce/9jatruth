/**
 * Seed/reference data for the normalized politics model:
 *  - political_positions (president … councillor)
 *  - political_parties (major registered Nigerian parties)
 *  - political_elections (2027 general election)
 *
 * Only verified, publicly known reference rows are seeded. Candidate/person
 * office-holder rows are NOT fabricated — those are populated via the admin
 * UI / verified datasets with source_urls + verification_status.
 */
import type { NeonQueryFunction } from "@neondatabase/serverless";

export const POLITICAL_POSITIONS: Array<{
  code: string;
  name: string;
  level: string;
  sort_order: number;
}> = [
  { code: "president", name: "President", level: "federal", sort_order: 0 },
  { code: "vice_president", name: "Vice President", level: "federal", sort_order: 1 },
  { code: "senator", name: "Senator", level: "federal", sort_order: 2 },
  { code: "house_of_rep", name: "House of Representatives Member", level: "federal", sort_order: 3 },
  { code: "governor", name: "State Governor", level: "state", sort_order: 4 },
  { code: "deputy_governor", name: "Deputy Governor", level: "state", sort_order: 5 },
  { code: "state_assembly", name: "State House of Assembly Member", level: "state", sort_order: 6 },
  { code: "lga_chairman", name: "LGA Chairman", level: "lga", sort_order: 7 },
  { code: "councillor", name: "Ward Councillor", level: "lga", sort_order: 8 },
];

/** Major INEC-registered parties (acronym, name, brand color). */
export const POLITICAL_PARTIES: Array<{
  acronym: string;
  name: string;
  color: string;
}> = [
  { acronym: "APC", name: "All Progressives Congress", color: "#006633" },
  { acronym: "PDP", name: "Peoples Democratic Party", color: "#1a5276" },
  { acronym: "LP", name: "Labour Party", color: "#c0392b" },
  { acronym: "NNPP", name: "New Nigeria Peoples Party", color: "#d35400" },
  { acronym: "APGA", name: "All Progressives Grand Alliance", color: "#27ae60" },
  { acronym: "SDP", name: "Social Democratic Party", color: "#2980b9" },
  { acronym: "ADC", name: "African Democratic Congress", color: "#8e44ad" },
  { acronym: "ADP", name: "Action Democratic Party", color: "#16a085" },
  { acronym: "AAC", name: "African Action Congress", color: "#7f8c8d" },
  { acronym: "NRM", name: "National Rescue Movement", color: "#34495e" },
  { acronym: "YPP", name: "Young Progressives Party", color: "#f1c40f" },
  { acronym: "APP", name: "Action Peoples Party", color: "#2c3e50" },
  { acronym: "ZLP", name: "Zenith Labour Party", color: "#e67e22" },
];

export const ELECTIONS: Array<{
  year: number;
  name: string;
  type: string;
  geo_scope: string;
  election_date: string | null;
  status: string;
}> = [
  {
    year: 2027,
    name: "2027 Nigerian General Election",
    type: "general",
    geo_scope: "national",
    election_date: "2027-02-18",
    status: "upcoming",
  },
];

export async function seedPoliticsReferenceData(sql: NeonQueryFunction<true, true>) {
  let positions = 0;
  for (const p of POLITICAL_POSITIONS) {
    await sql`
      INSERT INTO political_positions (code, name, level, sort_order)
      VALUES (${p.code}, ${p.name}, ${p.level}, ${p.sort_order})
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name, level = EXCLUDED.level, sort_order = EXCLUDED.sort_order
    `;
    positions++;
  }

  let parties = 0;
  for (const party of POLITICAL_PARTIES) {
    await sql`
      INSERT INTO political_parties (acronym, name, color)
      VALUES (${party.acronym}, ${party.name}, ${party.color})
      ON CONFLICT (acronym) DO UPDATE
      SET name = EXCLUDED.name, color = EXCLUDED.color
    `;
    parties++;
  }

  let elections = 0;
  for (const e of ELECTIONS) {
    await sql`
      INSERT INTO political_elections (year, name, type, geo_scope, election_date, status)
      VALUES (${e.year}, ${e.name}, ${e.type}, ${e.geo_scope}, ${e.election_date}, ${e.status})
      ON CONFLICT (year, type, geo_scope) DO UPDATE
      SET name = EXCLUDED.name, election_date = EXCLUDED.election_date, status = EXCLUDED.status
    `;
    elections++;
  }

  return { positions, parties, elections };
}
