import { EMERGENCY_AGENCIES, EmergencyAgency, NIGERIAN_STATES } from "@/lib/emergency-agencies";
import { STATE_EMERGENCY_CONTACTS, getStateEmergencyContact, NEMA_NATIONAL_LINE } from "@/lib/state-emergency-contacts";

/**
 * Seed the `emergency_contacts` table with:
 *  1. National-headquarters records for every supported Nigerian
 *     law-enforcement / emergency agency (idempotent — skipped if a national
 *     record for that agency_type already exists).
 *  2. State-level records for every Nigerian state (all 36 + FCT) for the
 *     major agencies: Police (NPF), Road Safety (FRSC), Fire Service, and
 *     Ambulance/EMS (NEMA). These now use REAL, publicly-listed per-state
 *     command phone numbers instead of the generic "112" national number, so
 *     the Alert feature surfaces a working local line for the user's state.
 *
 * Idempotent: a state record is only inserted when none exists yet for that
 * (agency_type, state) pair, so admin edits are never overwritten.
 */

/** Map agency_type -> which field of StateEmergencyContact holds its number. */
const AGENCY_FIELD_BY_TYPE: Record<string, keyof typeof STATE_EMERGENCY_CONTACTS[string]> = {
  police: "police",
  road_safety: "frsc",
  fire_service: "fire",
  ambulance: "nema",
};

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

  // Seed state-level records for every Nigerian state (all 36 + FCT) for the
  // major agencies: Police (NPF), Road Safety (FRSC), Fire Service, and
  // Ambulance/EMS. Uses REAL per-state command phone numbers from the verified
  // STATE_EMERGENCY_CONTACTS dataset (no generic "112").
  const majorAgencyIndexes = [0, 2, 5, 7]; // NPF, FRSC, Fire, EMS
  const stateSeeds: { state: string; agency: EmergencyAgency }[] = [];
  for (const state of NIGERIAN_STATES) {
    for (const idx of majorAgencyIndexes) {
      stateSeeds.push({ state, agency: EMERGENCY_AGENCIES[idx] });
    }
  }
  // Merge in the original explicit seeds (kept for the Lagos 767 ambulance line).
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

    // Resolve the real per-state number for this agency. Falls back to the
    // agency's national primary line only if no state-specific number exists.
    const field = AGENCY_FIELD_BY_TYPE[agency.type];
    const stateContact = getStateEmergencyContact(state);
    let primary = agency.phonePrimary;
    let source = agency.website ?? "9jatruth directory";
    if (field && stateContact) {
      primary = stateContact[field] ?? agency.phonePrimary;
      source = "9jatruth verified state directory";
    }

    // Lagos ambulance keeps its 767 toll-free line as a secondary.
    const secondary =
      state === "Lagos" && agency.type === "ambulance"
        ? "767"
        : agency.phoneSecondary ?? null;

    await sql`
      INSERT INTO emergency_contacts (
        agency_type, agency_name, phone_primary, phone_secondary,
        email, address, state, lga, community, village,
        verified, source
      ) VALUES (
        ${agency.type}, ${agency.name}, ${primary}, ${secondary},
        ${agency.email ?? null}, ${agency.address}, ${state}, NULL, NULL, NULL,
        true, ${source}
      )
    `;
  }
}

// Re-export so callers can reference the verified national NEMA line.
export { NEMA_NATIONAL_LINE };
