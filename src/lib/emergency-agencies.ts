/**
 * Nigerian Law Enforcement & Emergency Agencies Directory
 * --------------------------------------------------------
 * Authoritative metadata for every agency surfaced in the 9jatruth
 * "Alert" feature. Each agency has a national HQ record (and, where
 * available, state/LGA records seeded separately).
 *
 * Safety note: 112 is Nigeria's official national emergency number and
 * routes to the nearest emergency response centre. It is the verified
 * primary line for most agencies below. Agency-specific contact lines
 * and emails are publicly listed on the agencies' official websites;
 * users should confirm local numbers before relying on them.
 */

export type AgencySlug =
  | "nigeria-police-force"
  | "civil-defence"
  | "federal-road-safety"
  | "nigerian-army"
  | "nigeria-customs"
  | "federal-fire-service"
  | "hospital-emergency"
  | "ambulance-ems"
  | "efcc"
  | "ndlea"
  | "nafdac"
  | "mobile-police"
  | "dss"
  | "nigerian-navy"
  | "nigerian-air-force";

export interface EmergencyAgency {
  slug: AgencySlug;
  /** Stable key matching the emergency_contacts.agency_type column */
  type: string;
  name: string;
  shortName: string;
  category:
    | "Security & Law Enforcement"
    | "Emergency Response"
    | "Medical & Rescue"
    | "Regulatory & Anti-Crime"
    | "Armed Forces";
  /** Primary emergency line (verified national number) */
  phonePrimary: string;
  /** Secondary / office line (publicly listed, verify locally) */
  phoneSecondary?: string;
  email?: string;
  website?: string;
  address: string;
  headquartersState: string;
  /** Brand colour for logo + accents (hex) */
  color: string;
  /** Two-to-three letter monogram for the SVG logo badge */
  monogram: string;
  description: string;
  services: string[];
  jurisdiction: string;
}

export const EMERGENCY_AGENCIES: EmergencyAgency[] = [
  {
    slug: "nigeria-police-force",
    type: "police",
    name: "Nigeria Police Force",
    shortName: "NPF",
    category: "Security & Law Enforcement",
    phonePrimary: "112",
    phoneSecondary: "0806 154 6384",
    email: "info@npf.gov.ng",
    website: "https://npf.gov.ng",
    address: "Louis Edet House, Area 11, Garki, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#1d4ed8",
    monogram: "NPF",
    description:
      "The principal law enforcement agency of Nigeria, responsible for maintaining public order, preventing and detecting crime, and protecting lives and property nationwide.",
    services: [
      "Crime prevention & detection",
      "Public order & riot control",
      "Community policing",
      "Emergency response coordination",
    ],
    jurisdiction: "Nationwide — all 36 states + FCT",
  },
  {
    slug: "civil-defence",
    type: "civil_defence",
    name: "Nigeria Security and Civil Defence Corps",
    shortName: "NSCDC",
    category: "Security & Law Enforcement",
    phonePrimary: "112",
    phoneSecondary: "0803 731 3354",
    email: "info@nscdc.gov.ng",
    website: "https://nscdc.gov.ng",
    address: "National Headquarters, Wuse Zone 5, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#0e7490",
    monogram: "NS",
    description:
      "A paramilitary agency tasked with protecting lives and property, mitigating disasters, and supporting other security agencies during emergencies and national crises.",
    services: [
      "Disaster mitigation & rescue",
      "Critical infrastructure protection",
      "Peacekeeping & crisis support",
      "Agro-ranger operations",
    ],
    jurisdiction: "Nationwide — state commands in all 36 states + FCT",
  },
  {
    slug: "federal-road-safety",
    type: "road_safety",
    name: "Federal Road Safety Corps",
    shortName: "FRSC",
    category: "Regulatory & Anti-Crime",
    phonePrimary: "122",
    phoneSecondary: "0700 2255 3772",
    email: "info@frsc.gov.ng",
    website: "https://frsc.gov.ng",
    address: "4 Maputo Street, Wuse Zone 3, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#15803d",
    monogram: "FRSC",
    description:
      "Nigeria's lead agency for road traffic administration and safety management — responsible for preventing road crashes, enforcing traffic laws, and administering first aid at crash scenes.",
    services: [
      "Road traffic control",
      "Crash rescue & first aid",
      "Driver licensing & vehicle registration",
      "Highway patrol",
    ],
    jurisdiction: "Nationwide — sector commands across all states",
  },
  {
    slug: "nigerian-army",
    type: "army",
    name: "Nigerian Army",
    shortName: "NA",
    category: "Armed Forces",
    phonePrimary: "112",
    email: "info@army.mil.ng",
    website: "https://army.mil.ng",
    address: "Army Headquarters, Garki, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#166534",
    monogram: "NA",
    description:
      "The largest branch of the Nigerian Armed Forces, responsible for land-based military operations, territorial defence, and supporting civil authorities during large-scale emergencies and internal security operations.",
    services: [
      "Internal security operations",
      "Counter-terrorism & insurgency",
      "Disaster relief & civil support",
      "Territorial defence",
    ],
    jurisdiction: "Nationwide — divisions across all geopolitical zones",
  },
  {
    slug: "nigeria-customs",
    type: "customs",
    name: "Nigeria Customs Service",
    shortName: "NCS",
    category: "Regulatory & Anti-Crime",
    phonePrimary: "112",
    phoneSecondary: "0700 550 5400",
    email: "info@customs.gov.ng",
    website: "https://customs.gov.ng",
    address: "Nigeria Customs Headquarters, Old CBN Building, Garki, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#b45309",
    monogram: "NCS",
    description:
      "Responsible for revenue collection, anti-smuggling operations, and trade facilitation at Nigeria's borders, ports, and airports.",
    services: [
      "Anti-smuggling operations",
      "Border & port security",
      "Revenue collection (duties)",
      "Prohibited goods enforcement",
    ],
    jurisdiction: "Nationwide — commands at all ports, borders & airports",
  },
  {
    slug: "federal-fire-service",
    type: "fire_service",
    name: "Federal Fire Service",
    shortName: "FFS",
    category: "Emergency Response",
    phonePrimary: "112",
    phoneSecondary: "0803 577 3333",
    email: "info@fireservice.gov.ng",
    website: "https://fireservice.gov.ng",
    address: "Federal Fire Service Headquarters, Federal Secretariat, Phase 1, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#dc2626",
    monogram: "FFS",
    description:
      "Nigeria's federal agency for fire prevention, firefighting, rescue, and disaster response, with stations across the country.",
    services: [
      "Firefighting & rescue",
      "Fire prevention & safety education",
      "Building collapse rescue",
      "Hazardous material response",
    ],
    jurisdiction: "Nationwide — federal fire stations across states",
  },
  {
    slug: "hospital-emergency",
    type: "hospital_emergency",
    name: "Hospital Emergency Units",
    shortName: "HEU",
    category: "Medical & Rescue",
    phonePrimary: "112",
    email: "info@health.gov.ng",
    website: "https://health.gov.ng",
    address: "Federal Ministry of Health, Federal Secretariat, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#be123c",
    monogram: "ER",
    description:
      "Emergency departments at federal, state, and private hospitals providing 24/7 trauma, accident, and acute-care services.",
    services: [
      "Trauma & accident care",
      "Acute medical emergencies",
      "Surgical emergencies",
      "Triage & stabilisation",
    ],
    jurisdiction: "Nationwide — nearest hospital emergency department",
  },
  {
    slug: "ambulance-ems",
    type: "ambulance",
    name: "Ambulance & Emergency Medical Service",
    shortName: "EMS",
    category: "Medical & Rescue",
    phonePrimary: "112",
    phoneSecondary: "0802 285 5432",
    email: "info@nema.gov.ng",
    website: "https://nema.gov.ng",
    address: "NEMA National Headquarters, Ndubuisi Kanu Park, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#0d9488",
    monogram: "EMS",
    description:
      "Pre-hospital emergency medical services including ambulances and rapid response teams, coordinated through the national emergency number and state ambulance services.",
    services: [
      "Ambulance dispatch",
      "Pre-hospital trauma care",
      "Medical evacuation",
      "Mass-casualty response",
    ],
    jurisdiction: "Nationwide — coordinated via 112 & state EMS",
  },
  {
    slug: "efcc",
    type: "efcc",
    name: "Economic and Financial Crimes Commission",
    shortName: "EFCC",
    category: "Regulatory & Anti-Crime",
    phonePrimary: "112",
    phoneSecondary: "09 904 4666",
    email: "info@efcc.gov.ng",
    website: "https://efcc.gov.ng",
    address: "EFCC Headquarters, No. 5 Fomella Street, Off Adetokunbo Ademola Crescent, Wuse 2, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#7c3aed",
    monogram: "EFCC",
    description:
      "Nigeria's lead anti-corruption agency, tasked with investigating and prosecuting economic and financial crimes including fraud, money laundering, and cybercrime.",
    services: [
      "Fraud & cybercrime investigation",
      "Money laundering prosecution",
      "Asset recovery",
      "Public corruption cases",
    ],
    jurisdiction: "Nationwide — zonal offices across all geopolitical zones",
  },
  {
    slug: "ndlea",
    type: "ndlea",
    name: "National Drug Law Enforcement Agency",
    shortName: "NDLEA",
    category: "Regulatory & Anti-Crime",
    phonePrimary: "112",
    phoneSecondary: "0803 630 0703",
    email: "info@ndlea.gov.ng",
    website: "https://ndlea.gov.ng",
    address: "NDLEA National Headquarters, No. 6, Port Harcourt Crescent, Off Gimbiya Street, Garki, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#c2410c",
    monogram: "NDLEA",
    description:
      "The federal agency responsible for eliminating the cultivation, processing, trafficking, and abuse of illicit drugs and psychotropic substances in Nigeria.",
    services: [
      "Narcotics suppression",
      "Drug trafficking investigation",
      "Rehabilitation & counselling",
      "Drug demand reduction",
    ],
    jurisdiction: "Nationwide — state commands in all 36 states + FCT",
  },
  {
    slug: "nafdac",
    type: "nafdac",
    name: "National Agency for Food and Drug Administration and Control",
    shortName: "NAFDAC",
    category: "Regulatory & Anti-Crime",
    phonePrimary: "112",
    phoneSecondary: "0800 162 6232",
    email: "info@nafdac.gov.ng",
    website: "https://nafdac.gov.ng",
    address: "NAFDAC Headquarters, Idu Industrial Layout, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#0f766e",
    monogram: "NAFDAC",
    description:
      "The agency responsible for regulating and controlling the manufacture, importation, exportation, distribution, advertisement, sale, and use of food, drugs, cosmetics, chemicals, and medical devices in Nigeria.",
    services: [
      "Counterfeit drug control",
      "Food safety regulation",
      "Product registration & certification",
      "Public health alerts",
    ],
    jurisdiction: "Nationwide — zonal offices across all states",
  },
  {
    slug: "mobile-police",
    type: "mopol",
    name: "Mobile Police Force",
    shortName: "MOPOL",
    category: "Security & Law Enforcement",
    phonePrimary: "112",
    phoneSecondary: "0806 154 6384",
    email: "info@npf.gov.ng",
    website: "https://npf.gov.ng",
    address: "Force Headquarters, Louis Edet House, Area 11, Garki, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#1e3a8a",
    monogram: "MOPOL",
    description:
      "The mobile, riot-capable wing of the Nigeria Police Force, deployed for crowd control, armed response, VIP protection, and rapid deployment to flashpoints.",
    services: [
      "Rapid armed response",
      "Riot & crowd control",
      "VIP protection",
      "Quick-reaction deployment",
    ],
    jurisdiction: "Nationwide — MOPOL squadrons across all states",
  },
  {
    slug: "dss",
    type: "dss",
    name: "Department of State Services",
    shortName: "DSS",
    category: "Security & Law Enforcement",
    phonePrimary: "112",
    email: "info@dss.gov.ng",
    website: "https://dss.gov.ng",
    address: "National Headquarters, Aso Drive, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#3730a3",
    monogram: "DSS",
    description:
      "Nigeria's primary domestic intelligence agency, responsible for internal security intelligence, counter-intelligence, and the protection of senior government officials and critical infrastructure.",
    services: [
      "Internal security intelligence",
      "Counter-terrorism intelligence",
      "VIP & executive protection",
      "Threat assessment",
    ],
    jurisdiction: "Nationwide — state directorates in all 36 states + FCT",
  },
  {
    slug: "nigerian-navy",
    type: "navy",
    name: "Nigerian Navy",
    shortName: "NN",
    category: "Armed Forces",
    phonePrimary: "112",
    email: "info@navy.mil.ng",
    website: "https://navy.mil.ng",
    address: "Naval Headquarters, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#1e40af",
    monogram: "NN",
    description:
      "The naval branch of the Nigerian Armed Forces, responsible for maritime security, coastal defence, and protecting Nigeria's territorial waters and offshore assets.",
    services: [
      "Maritime security",
      "Anti-piracy & sea robbery patrol",
      "Search & rescue at sea",
      "Coastal & offshore defence",
    ],
    jurisdiction: "Nationwide — coastal & riverine commands",
  },
  {
    slug: "nigerian-air-force",
    type: "air_force",
    name: "Nigerian Air Force",
    shortName: "NAF",
    category: "Armed Forces",
    phonePrimary: "112",
    email: "info@airforce.mil.ng",
    website: "https://airforce.mil.ng",
    address: "Air Force Headquarters, Abuja (FCT)",
    headquartersState: "FCT",
    color: "#4338ca",
    monogram: "NAF",
    description:
      "The air branch of the Nigerian Armed Forces, providing air defence, tactical airlift, reconnaissance, and close air support for ground operations and disaster response.",
    services: [
      "Air defence",
      "Airlift & medical evacuation",
      "Reconnaissance & surveillance",
      "Close air support",
    ],
    jurisdiction: "Nationwide — air bases across all geopolitical zones",
  },
];

export function getAgencyBySlug(slug: string): EmergencyAgency | undefined {
  return EMERGENCY_AGENCIES.find((a) => a.slug === slug);
}

export function getAgencyByType(type: string): EmergencyAgency | undefined {
  return EMERGENCY_AGENCIES.find((a) => a.type === type);
}

/** All 36 Nigerian states + FCT, for the geographic filter dropdowns. */
export const NIGERIAN_STATES: string[] = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi",
  "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
  "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "FCT",
];
