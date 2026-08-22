import { EMERGENCY_AGENCIES, EmergencyAgency, NIGERIAN_STATES } from "@/lib/emergency-agencies";

/**
 * Seed the `emergency_contacts` table with national-headquarters records for
 * every supported Nigerian law-enforcement / emergency agency.
 *
 * Idempotent: a record is only inserted when no national-level record for that
 * agency_type already exists. State / LGA / community-level records are managed
 * by admins through the platform; the API falls back to these national records
 * when no state-specific contact is found.
 */
export async function seedEmergencyContacts(
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>
): Promise<void> {
  for (const a of EMERGENCY_AGENCIES) {
    const exists = (await sql`SELECT id FROM emergency_contacts
      WHERE agency_type = ${a.type} AND state IS NULL LIMIT 1`) as { id: number }[];

    if (exists && exists.length > 0) continue;

    await sql`
      INSERT INTO emergency_contacts (
        agency_type, agency_name, phone_primary, phone_secondary,
        email, address, state, lga, community, village,
        verified, source
      ) VALUES (
        ${a.type}, ${a.name}, ${a.phonePrimary}, ${a.phoneSecondary ?? null},
        ${a.email ?? null}, ${a.address}, NULL, NULL, NULL, NULL,
        false, ${a.website ?? "9jatruth directory"}
      )
    `;
  }

  // Seed a representative set of state-level records for the most populous
  // states, using the national emergency number (112). These make the
  // geographic filters immediately useful; admins can refine with exact
  // state command phone numbers.
  // Seed state-level records for every Nigerian state (all 36 + FCT) for the
  // major agencies: Police (NPF), Road Safety (FRSC), Fire Service, and
  // Ambulance/EMS. Uses the national emergency number (112) which routes to
  // the nearest response centre; the Lagos ambulance keeps its 767 line.
  // Admins refine with exact state command numbers via the dashboard.
  const majorAgencyIndexes = [0, 2, 5, 7]; // NPF, FRSC, Fire, EMS
  const stateSeeds: { state: string; agency: EmergencyAgency }[] = [];
  for (const state of NIGERIAN_STATES) {
    for (const idx of majorAgencyIndexes) {
      stateSeeds.push({ state, agency: EMERGENCY_AGENCIES[idx] });
    }
  }
  // Merge in the original explicit seeds (kept for the Lagos 767 line).
  stateSeeds.push(
    { state: "Lagos", agency: EMERGENCY_AGENCIES[0] },
    { state: "Lagos", agency: EMERGENCY_AGENCIES[2] },
    { state: "Lagos", agency: EMERGENCY_AGENCIES[5] },
    { state: "Lagos", agency: EMERGENCY_AGENCIES[7] },
    { state: "FCT", agency: EMERGENCY_AGENCIES[0] },
    { state: "FCT", agency: EMERGENCY_AGENCIES[2] },
    { state: "FCT", agency: EMERGENCY_AGENCIES[5] },
    { state: "Rivers", agency: EMERGENCY_AGENCIES[0] },
    { state: "Kano", agency: EMERGENCY_AGENCIES[0] },
  );

  for (const { state, agency } of stateSeeds) {
    const exists = (await sql`SELECT id FROM emergency_contacts
      WHERE agency_type = ${agency.type} AND state = ${state} LIMIT 1`) as { id: number }[];
    if (exists && exists.length > 0) continue;

    const secondary = state === "Lagos" && agency.type === "ambulance" ? "767" : agency.phoneSecondary ?? null;
    await sql`
      INSERT INTO emergency_contacts (
        agency_type, agency_name, phone_primary, phone_secondary,
        email, address, state, lga, community, village,
        verified, source
      ) VALUES (
        ${agency.type}, ${agency.name}, ${agency.phonePrimary}, ${secondary},
        ${agency.email ?? null}, ${agency.address}, ${state}, NULL, NULL, NULL,
        false, ${agency.website ?? "9jatruth directory"}
      )
    `;
  }
}
