/**
 * INEC official electoral geography importer for 9jatruth.
 * ─────────────────────────────────────────────────────────────────────────
 * Imports Nigeria's official electoral geography (37 states, 774 LGAs,
 * 8,809 wards) from data/inec-geo/{states,lgas,wards}.json (sourced from
 * github.com/saidiadegoke/nigeria-inec-geo, which scrapes INEC's CVR portal).
 *
 * For each state/LGA/ward it stores the official INEC code + portal id and
 * links states to their geopolitical zone. Matching is case-insensitive via
 * expression unique indexes (upper(name)), so the dataset's "LAGOS" matches an
 * existing "Lagos". Idempotent: re-running only fills in / updates codes.
 *
 * Used by:
 *  - scripts/import-inec-geo.mjs (standalone, with DATABASE_URL)
 *  - POST /api/admin/import-inec-geo (super-admin triggered, after deploy)
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Resolve the data dir against several candidate roots so it works both locally
// (src/lib -> ../../data) and inside the Vercel bundle (process.cwd() -> data).
function resolveDataDir(): string {
  const candidates = [
    join(__dirname, "..", "..", "data", "inec-geo"),
    join(process.cwd(), "data", "inec-geo"),
    join(__dirname, "data", "inec-geo"),
    join(process.cwd(), "src", "data", "inec-geo"),
  ];
  for (const c of candidates) {
    try {
      readFileSync(join(c, "states.json"), "utf8");
      return c;
    } catch {
      /* try next */
    }
  }
  throw new Error("INEC geo data directory not found (expected data/inec-geo/*.json)");
}
const DATA_DIR = resolveDataDir();

type NeonSql = {
  <T = any>(strings: TemplateStringsArray, ...values: any[]): Promise<T[]>;
  query?: (text: string, params: any[]) => Promise<any[]>;
  transaction?: (fn: any) => Promise<any>;
};

/** Uppercase, collapse whitespace, strip non-alphanumerics. */
function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

const ZONE_BY_STATE: Record<string, string> = {
  ABIA: "South East", ANAMBRA: "South East", EBONYI: "South East", ENUGU: "South East", IMO: "South East",
  AKWAIBOM: "South South", BAYELSA: "South South", CROSSRIVER: "South South", DELTA: "South South", EDO: "South South", RIVERS: "South South",
  EKITI: "South West", LAGOS: "South West", OGUN: "South West", ONDO: "South West", OSUN: "South West", OYO: "South West",
  BENUE: "North Central", FCT: "North Central", KOGI: "North Central", KWARA: "North Central", NASARAWA: "North Central", NIGER: "North Central", PLATEAU: "North Central",
  ADAMAWA: "North East", BAUCHI: "North East", BORNO: "North East", GOMBE: "North East", TARABA: "North East", YOBE: "North East",
  JIGAWA: "North West", KADUNA: "North West", KANO: "North West", KATSINA: "North West", KEBBI: "North West", SOKOTO: "North West", ZAMFARA: "North West",
};

export interface ImportResult {
  states: number; lgas: number; wards: number; skipped: number; errors: string[];
}

/** Build a multi-row INSERT ... ON CONFLICT upsert and run it via sql.query. */
async function bulkUpsert(
  sql: NeonSql,
  table: string,
  columns: string[],
  conflictExpr: string,
  updateCols: string[],
  rows: any[][],
  batch = 500,
): Promise<number> {
  if (!sql.query) throw new Error("neon sql.query not available on this client");
  if (!rows.length) return 0;
  let affected = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    const placeholders: string[] = [];
    const params: any[] = [];
    let p = 1;
    for (const row of chunk) {
      const ph: string[] = [];
      for (const val of row) {
        ph.push(`$${p++}`);
        params.push(val);
      }
      placeholders.push(`(${ph.join(",")})`);
    }
    const updateClause = updateCols.length
      ? ` DO UPDATE SET ${updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`
      : " DO NOTHING";
    const q = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders.join(
      ", ",
    )} ON CONFLICT ${conflictExpr}${updateClause}`;
    await sql.query(q, params);
    affected += chunk.length;
  }
  return affected;
}

export async function importInecGeo(sql: NeonSql, log = (m: string) => {}): Promise<ImportResult> {
  const result: ImportResult = { states: 0, lgas: 0, wards: 0, skipped: 0, errors: [] };

  const statesData = JSON.parse(readFileSync(join(DATA_DIR, "states.json"), "utf8")) as any[];
  const lgasData = JSON.parse(readFileSync(join(DATA_DIR, "lgas.json"), "utf8")) as any[];
  const wardsData = JSON.parse(readFileSync(join(DATA_DIR, "wards.json"), "utf8")) as any[];

  // ── 1. Ensure geopolitical zones exist ──
  const zoneRows = (await sql`SELECT id, name FROM geopolitical_zones`) as any[];
  const zoneByName = new Map(zoneRows.map((z) => [norm(z.name), z.id]));
  for (const zname of new Set(Object.values(ZONE_BY_STATE))) {
    if (!zoneByName.has(norm(zname))) {
      const ins = (await sql`INSERT INTO geopolitical_zones (name, code, short_code) VALUES (${zname}, ${zname.slice(0, 2).toUpperCase()}, ${zname.slice(0, 2).toUpperCase()}) RETURNING id`) as any[];
      zoneByName.set(norm(zname), ins[0]?.id);
    }
  }

  // ── 2. States: bulk upsert by upper(name), setting INEC code + zone ──
  const stateRows: any[][] = [];
  for (const st of statesData) {
    const zoneName = ZONE_BY_STATE[norm(st.name)] || null;
    const zoneId = zoneName ? zoneByName.get(norm(zoneName)) ?? null : null;
    stateRows.push([st.name, st.code, String(st.portal_id), zoneId]);
  }
  result.states = await bulkUpsert(
    sql, "states", ["name", "inec_code", "portal_id", "geopolitical_zone_id"],
    "(upper(name))", ["inec_code", "portal_id", "geopolitical_zone_id"], stateRows, 500,
  );
  const codedStates = (await sql`SELECT id, inec_code, name FROM states WHERE inec_code IS NOT NULL`) as any[];
  const stateByCode = new Map<string, number>(codedStates.map((s) => [s.inec_code, s.id]));
  log(`States: ${result.states} upserted, ${stateByCode.size} coded`);

  // ── 3. LGAs: bulk upsert by (state_id, upper(name)), setting INEC code ──
  const lgaRows: any[][] = [];
  for (const lg of lgasData) {
    const stateId = stateByCode.get(lg.state_code);
    if (!stateId) { result.skipped++; continue; }
    lgaRows.push([lg.name, stateId, lg.code, String(lg.portal_id)]);
  }
  result.lgas = await bulkUpsert(
    sql, "lgas", ["name", "state_id", "inec_code", "portal_id"],
    "(state_id, upper(name))", ["inec_code", "portal_id"], lgaRows, 500,
  );
  const codedLgas = (await sql`SELECT id, inec_code, state_id FROM lgas WHERE inec_code IS NOT NULL`) as any[];
  const stateIdToCode = new Map<number, string>(codedStates.map((s) => [s.id, s.inec_code]));
  const lgaByCode = new Map<string, number>();
  for (const l of codedLgas) {
    const sc = stateIdToCode.get(l.state_id);
    if (sc && l.inec_code) lgaByCode.set(`${sc}|${l.inec_code}`, l.id);
  }
  log(`LGAs: ${result.lgas} upserted, ${lgaByCode.size} coded`);

  // ── 4. Wards: chunked bulk upsert by (lga_id, upper(name)) with INEC code ──
  const wardRows: any[][] = [];
  for (const w of wardsData) {
    const lgaId = lgaByCode.get(`${w.state_code}|${w.lga_code}`);
    if (!lgaId) { result.skipped++; continue; }
    const stateId = stateByCode.get(w.state_code) ?? null;
    const wardCode = `${w.state_code}/${w.lga_code}/${w.code}`;
    wardRows.push([w.name, wardCode, stateId, lgaId, w.code, String(w.portal_id), "inec"]);
  }
  if (wardRows.length) {
    result.wards = await bulkUpsert(
      sql, "wards", ["name", "code", "state_id", "lga_id", "inec_code", "portal_id", "source"],
      "(lga_id, upper(name))", ["code", "inec_code", "portal_id", "state_id", "source"],
      wardRows, 1000,
    );
  }
  log(`Wards: ${result.wards} upserted (bulk upsert)`);

  return result;
}
