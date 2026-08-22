import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envText = readFileSync(".env.vercel", "utf8");
const DATABASE_URL = envText.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!DATABASE_URL) { console.error("No DATABASE_URL"); process.exit(1); }
const sql = neon(DATABASE_URL);

const regions = ["North Central","North East","North West","South East","South South","South West"];
const states = [
  ["Lagos","South West"],["Ogun","South West"],["Oyo","South West"],["Osun","South West"],
  ["Ondo","South West"],["Ekiti","South East"],["Abia","South East"],["Anambra","South East"],
  ["Ebonyi","South East"],["Enugu","South East"],["Imo","South East"],["Akwa Ibom","South South"],
  ["Bayelsa","South South"],["Cross River","South South"],["Delta","South South"],["Edo","South South"],
  ["Rivers","South South"],["Benue","North Central"],["Kogi","North Central"],["Kwara","North Central"],
  ["Nasarawa","North Central"],["Plateau","North Central"],["FCT","North Central"],["Adamawa","North East"],
  ["Bauchi","North East"],["Borno","North East"],["Gombe","North East"],["Taraba","North East"],
  ["Yobe","North East"],["Jigawa","North West"],["Kaduna","North West"],["Kano","North West"],
  ["Katsina","North West"],["Kebbi","North West"],["Sokoto","North West"],["Zamfara","North West"],
];
const lgas = {
  "Lagos": ["Agege","Ajeromi-Ifelodun","Alimosho","Amuwo-Odofin","Apapa","Badagry","Epe","Eti-Osa","Ibeju-Lekki","Ifako-Ijaiye","Ikeja","Ikorodu","Kosofe","Lagos Island","Lagos Mainland","Mushin","Ojo","Oshodi-Isolo","Shomolu","Surulere"],
  "Ogun": ["Abeokuta North","Abeokuta South","Ado-Odo/Ota","Egbado North","Egbado South","Ewekoro","Ifo","Ijebu East","Ijebu North","Ijebu North East","Ijebu Ode","Ikenne","Imeko-Afon","Ipokia","Obafemi-Owode","Odeda","Odogbolu","Remo North","Shagamu","Yewa South"],
  "Oyo": ["Afijio","Akinyele","Atiba","Atisbo","Egbeda","Ibadan North","Ibadan North East","Ibadan North West","Ibadan South East","Ibadan South West","Ibarapa Central","Ibarapa East","Ibarapa North","Ido","Irepo","Iseyin","Itesiwaju","Iwajowa","Kajola","Lagelu","Ogbomoso North","Ogbomoso South","Ogo Oluwa","Olorunsogo","Oluyole","Ona Ara","Orelope","Ori Ire","Surulere","Saki East","Saki West"],
  "FCT": ["Abaji","Bwari","Gwagwalada","Kuje","Kwali","Municipal Area Council"],
  "Rivers": ["Abua-Odual","Ahoada East","Ahoada West","Akuku-Toru","Andoni","Asari-Toru","Bonny","Degema","Eleme","Emuoha","Etche","Gokana","Ikwerre","Khana","Obio-Akpor","Ogba-Egbema-Ndoni","Ogu-Bolo","Okirika","Omuma","Opobo-Nkoro","Oyigbo","Port Harcourt","Tai"],
  "Enugu": ["Aninri","Awgu","Enugu East","Enugu North","Enugu South","Ezeagu","Igbo Etiti","Igbo Eze North","Igbo Eze South","Isi Uzo","Nkanu East","Nkanu West","Nsukka","Oji River","Udenu","Udi","Uzo Uwani"],
  "Kano": ["Ajingi","Albasu","Bagwai","Bebeji","Bichi","Bunkure","Dala","Dambatta","Dawakin Kudu","Dawakin Tofa","Doguwa","Fagge","Gabasawa","Garko","Garun Mallam","Gaya","Gezawa","Gwale","Gwarzo","Kabo","Kano Municipal","Karaye","Kibiya","Kiru","Kumbotso","Kunchi","Kura","Madobi","Makoda","Minjibir","Nasarawa","Rano","Rimin Gado","Rogo","Shanono","Sumaila","Takai","Tarauni","Tofa","Tsanyawa","Tudun Wada","Ungogo","Warawa","Wudil"],
  "Kaduna": ["Birnin Gwari","Chikun","Giwa","Igabi","Ikara","Jaba","Jema'a","Kachia","Kaduna North","Kaduna South","Kagarko","Kajuru","Kaura","Kauru","Kubau","Kudan","Lere","Makarfi","Sabon Gari","Sanga","Soba","Zaria"],
};

const esc = (s) => String(s).replace(/'/g, "''");

// 1. regions
await sql`INSERT INTO regions (name) VALUES ('North Central'), ('North East'), ('North West'), ('South East'), ('South South'), ('South West') ON CONFLICT DO NOTHING`;
console.log("regions seeded:", (await sql`SELECT COUNT(*) c FROM regions`)[0].c);

// 2. states (use raw to allow subqueries)
const stateVals = states.map(([n, rg]) => `('${esc(n)}', (SELECT id FROM regions WHERE name='${esc(rg)}'))`).join(", ");
await sql.query(`INSERT INTO states (name, region_id) VALUES ${stateVals} ON CONFLICT DO NOTHING`);
console.log("states seeded:", (await sql`SELECT COUNT(*) c FROM states`)[0].c);

// 3. LGAs (per state)
for (const [state, list] of Object.entries(lgas)) {
  const lvals = list.map((lga) => `('${esc(lga)}', (SELECT id FROM states WHERE name='${esc(state)}'))`).join(", ");
  await sql.query(`INSERT INTO lgas (name, state_id) VALUES ${lvals} ON CONFLICT DO NOTHING`);
}
console.log("lgas seeded:", (await sql`SELECT COUNT(*) c FROM lgas`)[0].c);

// 4. schema_migrations version marker
await sql`CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW())`;
await sql`INSERT INTO schema_migrations (version) VALUES ('2026-08-22-v1') ON CONFLICT (version) DO UPDATE SET version = EXCLUDED.version`;
console.log("schema_migrations version set");
console.log("DONE");
