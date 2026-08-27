#!/usr/bin/env node
/**
 * Seed current national office holders (President, VP) + 36 state governors.
 * Idempotent: upserts persons by slug; office_holders use ON CONFLICT DO NOTHING.
 * All records verification_status='unverified' (best-effort, to be verified via admin UI).
 *
 *   DATABASE_URL=postgresql://... node scripts/seed-office-holders.mjs
 */
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// President & VP
const FEDERAL = [
  { slug: "bola-ahmed-tinubu", name: "Bola Ahmed Tinubu", party: "APC", position: "president", origin: "LAGOS", since: "2023-05-29" },
  { slug: "kashim-shettima", name: "Kashim Shettima", party: "APC", position: "vice_president", origin: "BORNO", since: "2023-05-29" },
];

// 36 state governors (inaugurated 2023-05-29 unless noted). Best-effort, unverified.
const GOVERNORS = [
  ["ABIA", "Alex Otti", "LP"], ["ADAMAWA", "Ahmadu Umaru Fintiri", "PDP"],
  ["AKWA IBOM", "Umo Eno", "PDP"], ["ANAMBRA", "Chukwuma Soludo", "APGA"],
  ["BAUCHI", "Bala Mohammed", "PDP"], ["BAYELSA", "Douye Diri", "PDP"],
  ["BENUE", "Hyacinth Alia", "APC"], ["BORNO", "Babagana Umara Zulum", "APC"],
  ["CROSS RIVER", "Bassey Otu", "APC"], ["DELTA", "Sheriff Oborevwori", "PDP"],
  ["EBONYI", "Francis Nwifuru", "APC"], ["EDO", "Monday Okpebholo", "APC"],
  ["EKITI", "Biodun Oyebanji", "APC"], ["ENUGU", "Peter Mbah", "PDP"],
  ["GOMBE", "Muhammad Inuwa Yahaya", "APC"], ["IMO", "Hope Uzodinma", "APC"],
  ["JIGAWA", "Umar Namadi", "APC"], ["KADUNA", "Uba Sani", "APC"],
  ["KANO", "Abba Kabir Yusuf", "NNPP"], ["KATSINA", "Umar Dikko Radda", "APC"],
  ["KEBBI", "Nasir Idris", "APC"], ["KOGI", "Ahmed Usman Ododo", "APC"],
  ["KWARA", "AbdulRahman AbdulRazaq", "APC"], ["LAGOS", "Babajide Sanwo-Olu", "APC"],
  ["NASARAWA", "Abdullahi Sule", "APC"], ["NIGER", "Mohammed Umar Bago", "APC"],
  ["OGUN", "Dapo Abiodun", "APC"], ["ONDO", "Lucky Aiyedatiwa", "APC"],
  ["OSUN", "Ademola Adeleke", "PDP"], ["OYO", "Seyi Makinde", "PDP"],
  ["PLATEAU", "Caleb Mutfwang", "PDP"], ["RIVERS", "Siminalayi Fubara", "PDP"],
  ["SOKOTO", "Ahmed Aliyu", "APC"], ["TARABA", "Agbu Kefas", "PDP"],
  ["YOBE", "Mai Mala Buni", "APC"], ["ZAMFARA", "Dauda Lawal", "PDP"],
];

const slugify = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  // one active federal holder per position (president / VP)
  await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_office_holders_federal_unique
    ON office_holders(position_id) WHERE status='active' AND state_id IS NULL AND lga_id IS NULL AND ward_id IS NULL`);

  // resolve positions + states
  const positions = await sql`SELECT id, code FROM political_positions`;
  const posByCode = new Map(positions.map((p) => [p.code, p.id]));
  const states = await sql`SELECT id, name FROM states`;
  const stateByName = new Map(states.map((s) => [s.name.toUpperCase(), s.id]));

  let persons = 0, holders = 0;

  // federal
  for (const f of FEDERAL) {
    await sql`INSERT INTO political_persons (slug, full_name, nationality, state_of_origin, verification_status, data_confidence, source_urls)
      VALUES (${f.slug}, ${f.name}, 'Nigerian', ${f.origin}, 'unverified', 30, 'https://en.wikipedia.org/wiki/Bola_Tinubu')
      ON CONFLICT (slug) DO UPDATE SET full_name = EXCLUDED.full_name, state_of_origin = EXCLUDED.state_of_origin`;
    persons++;
    const pid = (await sql`SELECT id FROM political_persons WHERE slug = ${f.slug} LIMIT 1`)[0]?.id;
    if (pid) {
      await sql`INSERT INTO office_holders (person_id, position_id, party_acronym, term_start, incumbent_since, status, verification_status, source_urls)
        VALUES (${pid}, ${posByCode.get(f.position)}, ${f.party}, ${f.since}, ${f.since}, 'active', 'unverified', 'https://en.wikipedia.org/wiki/Bola_Tinubu')
        ON CONFLICT DO NOTHING`;
      holders++;
    }
  }

  // governors
  for (const [state, name, party] of GOVERNORS) {
    const slug = slugify(name);
    const sid = stateByName.get(state);
    if (!sid) { console.log("  skip (no state):", state, name); continue; }
    await sql`INSERT INTO political_persons (slug, full_name, nationality, state_of_origin, verification_status, data_confidence, source_urls)
      VALUES (${slug}, ${name}, 'Nigerian', ${state}, 'unverified', 25, 'https://en.wikipedia.org/wiki/List_of_state_governors_of_Nigeria')
      ON CONFLICT (slug) DO UPDATE SET full_name = EXCLUDED.full_name, state_of_origin = EXCLUDED.state_of_origin`;
    persons++;
    const pid = (await sql`SELECT id FROM political_persons WHERE slug = ${slug} LIMIT 1`)[0]?.id;
    if (pid) {
      await sql`INSERT INTO office_holders (person_id, position_id, party_acronym, state_id, term_start, incumbent_since, status, verification_status, source_urls)
        VALUES (${pid}, ${posByCode.get("governor")}, ${party}, ${sid}, '2023-05-29', '2023-05-29', 'active', 'unverified', 'https://en.wikipedia.org/wiki/List_of_state_governors_of_Nigeria')
        ON CONFLICT DO NOTHING`;
      holders++;
    }
  }

  console.log(JSON.stringify({ persons, holders, parties_available: 5 }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
