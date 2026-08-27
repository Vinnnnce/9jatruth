/**
 * Nigeria electoral geography (INEC) — zone mapping + idempotent importer.
 *
 * Data source: github.com/saidiadegoke/nigeria-inec-geo (data/{states,lgas,wards}.json)
 * — 37 states (incl. FCT), 774 LGAs, 8809 wards, each with an official INEC code.
 *
 * The INEC dataset does not tag geopolitical zones, so we map each state to one of
 * Nigeria's six zones (FCT grouped under North Central). This keeps `regions` as the
 * geopolitical-zone table that `states` references.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface InecState {
  portal_id: string;
  code: string;
  name: string;
  raw?: string;
}
export interface InecLga {
  portal_id: string;
  code: string;
  name: string;
  raw?: string;
  state_portal_id: string;
  state_code: string;
  state_name: string;
}
export interface InecWard {
  portal_id: string;
  code: string;
  name: string;
  raw?: string;
  lga_portal_id: string;
  lga_code: string;
  lga_name: string;
  state_portal_id: string;
  state_code: string;
  state_name: string;
}

/** Nigeria's six geopolitical zones (+ FCT under North Central). */
export const GEOPOLITICAL_ZONES: Array<{ code: string; name: string; slug: string }> = [
  { code: "NC", name: "North Central", slug: "north-central" },
  { code: "NE", name: "North East", slug: "north-east" },
  { code: "NW", name: "North West", slug: "north-west" },
  { code: "SE", name: "South East", slug: "south-east" },
  { code: "SS", name: "South South", slug: "south-south" },
  { code: "SW", name: "South West", slug: "south-west" },
];

const STATE_TO_ZONE: Record<string, string> = {
  ABIA: "SE", ANAMBRA: "SE", EBONYI: "SE", ENUGU: "SE", IMO: "SE",
  AKWA: "SS", BAYELSA: "SS", CROSS: "SS", DELTA: "SS", EDO: "SS", RIVERS: "SS",
  EKITI: "SW", LAGOS: "SW", OGUN: "SW", ONDO: "SW", OSUN: "SW", OYO: "SW",
  ADAMAWA: "NE", BAUCHI: "NE", BORNO: "NE", GOMBE: "NE", TARABA: "NE", YOBE: "NE",
  JIGAWA: "NW", KADUNA: "NW", KANO: "NW", KATSINA: "NW", KEBBI: "NW", SOKOTO: "NW", ZAMFARA: "NW",
  BENUE: "NC", KOJI: "NC", KOGI: "NC", NASARAWA: "NC", PLATEAU: "NC",
  NIGER: "NW", "FCT": "NC", "FEDERAL CAPITAL TERRITORY": "NC", ABUJA: "NC",
};

/** Resolve a state name to its geopolitical-zone code. */
export function zoneForState(stateName: string): string {
  const upper = stateName.toUpperCase().trim();
  if (STATE_TO_ZONE[upper]) return STATE_TO_ZONE[upper];
  // partial matches for "CROSS RIVER", "AKWA IBOM", "NIGER" already exact above
  if (upper.startsWith("CROSS")) return "SS";
  if (upper.startsWith("AKWA")) return "SS";
  return "NC";
}

function dataDir(): string {
  // Works both when run from the Next app (process.cwd()) and from a script.
  const candidates = [
    resolve(process.cwd(), "scripts/data/inec-geo"),
    resolve(process.cwd(), "data/inec-geo"),
  ];
  // When this module is under src/lib, the repo root is two levels up from src.
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    candidates.push(resolve(here, "../../scripts/data/inec-geo"));
    candidates.push(resolve(here, "../../../scripts/data/inec-geo"));
  } catch {
    // import.meta.url may be unavailable in some bundlers; ignore.
  }
  for (const c of candidates) {
    if (existsSync(resolve(c, "states.json"))) return c;
  }
  return candidates[0];
}

export function loadInecGeo() {
  const dir = dataDir();
  const states = JSON.parse(readFileSync(resolve(dir, "states.json"), "utf8")) as InecState[];
  const lgas = JSON.parse(readFileSync(resolve(dir, "lgas.json"), "utf8")) as InecLga[];
  const wards = JSON.parse(readFileSync(resolve(dir, "wards.json"), "utf8")) as InecWard[];
  return { states, lgas, wards };
}

/**
 * Idempotent import of INEC geography into regions/states/lgas/wards.
 * Uses ON CONFLICT upserts so it is safe to re-run.
 *
 * @param sql   Neon tagged-template client (from getDb())
 * @param opts  Optionally restrict to a single state (by INEC code or name) for
 *              chunked runs that stay well under serverless function timeouts.
 */
export async function importInecGeo(
  sql: any,
  opts: { stateCode?: string; stateName?: string } = {}
): Promise<{ states: number; lgas: number; wards: number; zones: number }> {
  const { states, lgas, wards } = loadInecGeo();

  // 1. Upsert geopolitical zones (regions)
  let zonesUpserted = 0;
  for (const z of GEOPOLITICAL_ZONES) {
    await sql`
      INSERT INTO regions (name, code, slug)
      VALUES (${z.name}, ${z.code}, ${z.slug})
      ON CONFLICT (name) DO UPDATE
      SET code = EXCLUDED.code, slug = EXCLUDED.slug
    `;
    zonesUpserted++;
  }

  // 2. Upsert states
  const wantState =
    opts.stateCode || opts.stateName
      ? (s: InecState) =>
          (opts.stateCode && s.code === opts.stateCode) ||
          (opts.stateName && s.name.toUpperCase() === opts.stateName!.toUpperCase())
      : () => true;

  let stateCount = 0;
  const stateIdByPortalId = new Map<string, number>();
  for (const s of states) {
    if (!wantState(s)) continue;
    const zoneCode = zoneForState(s.name);
    const region = (await sql`SELECT id FROM regions WHERE code = ${zoneCode} LIMIT 1`) as any[];
    const regionId = region[0]?.id ?? null;
    const inserted = (await sql`
      INSERT INTO states (name, code, portal_id, region_id, source, source_updated_at)
      VALUES (${s.name}, ${s.code}, ${parseInt(s.portal_id, 10)}, ${regionId}, 'INEC', NOW())
      ON CONFLICT (name) DO UPDATE
      SET code = EXCLUDED.code,
          portal_id = EXCLUDED.portal_id,
          region_id = COALESCE(states.region_id, EXCLUDED.region_id),
          source = EXCLUDED.source,
          source_updated_at = EXCLUDED.source_updated_at
      RETURNING id
    `) as any[];
    if (inserted[0]?.id) {
      stateIdByPortalId.set(s.portal_id, inserted[0].id);
      stateCount++;
    }
  }

  // 3. Upsert LGAs (only for the states we imported)
  let lgaCount = 0;
  const lgaIdByPortalId = new Map<string, number>();
  for (const l of lgas) {
    const stateId = stateIdByPortalId.get(l.state_portal_id);
    if (!stateId) continue;
    const inserted = (await sql`
      INSERT INTO lgas (name, code, portal_id, state_id, source, source_updated_at)
      VALUES (${l.name}, ${l.code}, ${parseInt(l.portal_id, 10)}, ${stateId}, 'INEC', NOW())
      ON CONFLICT DO NOTHING
      RETURNING id
    `) as any[];
    if (inserted[0]?.id) {
      lgaIdByPortalId.set(l.portal_id, inserted[0].id);
      lgaCount++;
    } else {
      // Row already existed — fetch its id so wards resolve.
      const existing = (await sql`SELECT id FROM lgas WHERE portal_id = ${parseInt(l.portal_id, 10)} AND state_id = ${stateId} LIMIT 1`) as any[];
      if (existing[0]?.id) lgaIdByPortalId.set(l.portal_id, existing[0].id);
    }
  }

  // 4. Upsert wards (only for the LGAs we imported)
  let wardCount = 0;
  for (const w of wards) {
    const lgaId = lgaIdByPortalId.get(w.lga_portal_id);
    if (!lgaId) continue;
    const stateId = stateIdByPortalId.get(w.state_portal_id);
    if (!stateId) continue;
    await sql`
      INSERT INTO wards (code, name, lga_id, state_id, portal_id, source, source_updated_at)
      VALUES (${w.code}, ${w.name}, ${lgaId}, ${stateId}, ${parseInt(w.portal_id, 10)}, 'INEC', NOW())
      ON CONFLICT (lga_id, code, name) DO UPDATE
      SET portal_id = EXCLUDED.portal_id,
          source = EXCLUDED.source,
          source_updated_at = EXCLUDED.source_updated_at
    `;
    wardCount++;
  }

  return { states: stateCount, lgas: lgaCount, wards: wardCount, zones: zonesUpserted };
}
