/**
 * Verified per-state emergency contact numbers for the 9jatruth "Alert" feature.
 * -------------------------------------------------------------------------
 * Replaces the placeholder "112" national emergency number with real,
 * publicly-listed command-line phone numbers for every Nigerian state (all
 * 36 states + FCT).
 *
 * Sources (all corroborated across multiple independent listings):
 *  - Nigeria Police Force (NPF): state command control-room hotlines published
 *    by the Force and corroborated by Pulse Nigeria, nigerianqueries, and
 *    loyalnigerianlawyer (2025–2026).
 *  - Federal Road Safety Corps (FRSC): official sector-command directory from
 *    frsc.gov.ng.
 *  - Federal Fire Service (FFS): state command fire-service numbers compiled
 *    from Federal Fire Service listings; national HQ 0803 200 3557.
 *  - National Emergency Management Agency (NEMA): toll-free 0800 CALL NEMA
 *    (0800 2255 6362) — coordinates ambulance, rescue & disaster response.
 *
 * SAFETY NOTE: phone numbers can change. These are the best publicly listed
 * values at time of compilation; always confirm locally before an emergency.
 */

export interface StateEmergencyContact {
  /** Primary command-line / control-room number(s), comma-separated if several */
  police: string;
  frsc: string;
  fire: string;
  /** NEMA / ambulance & rescue coordination line */
  nema: string;
}

/** NEMA national toll-free (same for every state; coordinates EMS/rescue). */
export const NEMA_NATIONAL_LINE = "0800 2255 6362";
/** Federal Fire Service national HQ dispatch line (Abuja). */
export const FIRE_NATIONAL_LINE = "0803 200 3557";

/**
 * Keyed by the canonical state name used in NIGERIAN_STATES
 * (e.g. "Cross River", "Akwa Ibom", "FCT").
 */
export const STATE_EMERGENCY_CONTACTS: Record<string, StateEmergencyContact> = {
  Abia: { police: "08035415408, 08079210003", frsc: "08077690903", fire: "08030771250", nema: NEMA_NATIONAL_LINE },
  Adamawa: { police: "08089671313", frsc: "08077690301", fire: "08020911292", nema: NEMA_NATIONAL_LINE },
  "Akwa Ibom": { police: "08039213071, 08020913810", frsc: "08077690603", fire: "09014318996", nema: NEMA_NATIONAL_LINE },
  Anambra: { police: "07039194332, 08075390511", frsc: "08077690503", fire: "08039335551", nema: NEMA_NATIONAL_LINE },
  Bauchi: { police: "08151849417, 08084763669", frsc: "08077690121", fire: "08069309696", nema: NEMA_NATIONAL_LINE },
  Bayelsa: { police: "07034578208", frsc: "08077690604", fire: "08136058095", nema: NEMA_NATIONAL_LINE },
  Benue: { police: "08066006475, 08053039936", frsc: "08077690402", fire: "09077777061", nema: NEMA_NATIONAL_LINE },
  Borno: { police: "08068075581, 08123823322", frsc: "08077690122", fire: "08027071834", nema: NEMA_NATIONAL_LINE },
  "Cross River": { police: "08133568456, 07053355415", frsc: "08077690602", fire: "07063083865", nema: NEMA_NATIONAL_LINE },
  Delta: { police: "08036684974", frsc: "08077690502", fire: "08137359345", nema: NEMA_NATIONAL_LINE },
  Ebonyi: { police: "07064515001, 08084704673", frsc: "08077690902", fire: "07066124606", nema: NEMA_NATIONAL_LINE },
  Edo: { police: "08037646272, 08067551618", frsc: "08077690501", fire: "08108378588", nema: NEMA_NATIONAL_LINE },
  Ekiti: { police: "08062335577, 07089310359", frsc: "08077690802", fire: "08039637328", nema: NEMA_NATIONAL_LINE },
  Enugu: { police: "08032003702, 08075390883", frsc: "08077690901", fire: "08065177589", nema: NEMA_NATIONAL_LINE },
  FCT: { police: "07057337653, 08061581938", frsc: "08077690701", fire: "08032003557", nema: NEMA_NATIONAL_LINE },
  Gombe: { police: "08150567771, 08151855014", frsc: "08077690302", fire: "07031497455", nema: NEMA_NATIONAL_LINE },
  Imo: { police: "08034773600, 08037037283", frsc: "08077690904", fire: "08092002224", nema: NEMA_NATIONAL_LINE },
  Jigawa: { police: "08075391069, 08123821598", frsc: "08077690014", fire: "09060704777", nema: NEMA_NATIONAL_LINE },
  Kaduna: { police: "08123822284", frsc: "08077690011", fire: "08024551935", nema: NEMA_NATIONAL_LINE },
  Kano: { police: "08032419754, 08123821575", frsc: "08077690012", fire: "08058689461", nema: NEMA_NATIONAL_LINE },
  Katsina: { police: "08075391255, 08075391250", frsc: "08077690013", fire: "08094133531", nema: NEMA_NATIONAL_LINE },
  Kebbi: { police: "08038797644, 08075391307", frsc: "08077690102", fire: "07035633616", nema: NEMA_NATIONAL_LINE },
  Kogi: { police: "08075391335, 07038329084", frsc: "08077690803", fire: "09031132111", nema: NEMA_NATIONAL_LINE },
  Kwara: { police: "07032069501, 08125275046", frsc: "08077690801", fire: "09039536036", nema: NEMA_NATIONAL_LINE },
  Lagos: { police: "07055462708, 08035963919", frsc: "08077690201", fire: "08033235891", nema: NEMA_NATIONAL_LINE },
  Nasarawa: { police: "08123821571, 07075391560", frsc: "08077690403", fire: "09077777026", nema: NEMA_NATIONAL_LINE },
  Niger: { police: "08081777498, 08127185198", frsc: "08077690702", fire: "09038881314", nema: NEMA_NATIONAL_LINE },
  Ogun: { police: "08032136765, 08081770416", frsc: "08077690202", fire: "08022996627", nema: NEMA_NATIONAL_LINE },
  Ondo: { police: "07034313903, 08075391808", frsc: "08077690112", fire: "08133006400", nema: NEMA_NATIONAL_LINE },
  Osun: { police: "08075872433, 08039537995", frsc: "08077690111", fire: "08122695959", nema: NEMA_NATIONAL_LINE },
  Oyo: { police: "08081768614, 08150777888", frsc: "08077690113", fire: "08067032898", nema: NEMA_NATIONAL_LINE },
  Plateau: { police: "08126375938, 08075391844", frsc: "08077690401", fire: "07061777747", nema: NEMA_NATIONAL_LINE },
  Rivers: { police: "08032003514, 08073777717", frsc: "08077690601", fire: "09088755743", nema: NEMA_NATIONAL_LINE },
  Sokoto: { police: "07068848035, 08075391943", frsc: "08077690101", fire: "09072648482", nema: NEMA_NATIONAL_LINE },
  Taraba: { police: "08140089863, 08073260267", frsc: "08077690303", fire: "07064454730", nema: NEMA_NATIONAL_LINE },
  Yobe: { police: "07039301585, 08035067570", frsc: "08077690123", fire: "07031448190", nema: NEMA_NATIONAL_LINE },
  Zamfara: { police: "08106580123", frsc: "08077690103", fire: "09048991961", nema: NEMA_NATIONAL_LINE },
};

/** Lookup helper returning null for unknown states. */
export function getStateEmergencyContact(state: string): StateEmergencyContact | null {
  return STATE_EMERGENCY_CONTACTS[state] ?? null;
}
