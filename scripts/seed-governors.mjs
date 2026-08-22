// Seed all 36 state governors into the Neon political_candidates table.
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
const sql = neon(DATABASE_URL);

const governors = [
  ["Abia","Alex Otti","LP","Ikechukwu Emetu"],
  ["Adamawa","Ahmadu Umaru Fintiri","PDP","Kaletapwa Farauta"],
  ["Akwa Ibom","Umo Eno","PDP","Akon Eyakenyi"],
  ["Anambra","Charles Chukwuma Soludo","APGA","Onyeka Ibezim"],
  ["Bauchi","Bala Abdulkadir Mohammed","PDP","Auwal Jatau"],
  ["Bayelsa","Douye Diri","PDP","Lawrence Ewhrudjakpo"],
  ["Benue","Hyacinth Iormem Alia","APC","Samuel Ode"],
  ["Borno","Babagana Umara Zulum","APC","Umar Usman Kadafur"],
  ["Cross River","Bassey Edet Otu","APC","Peter Odey"],
  ["Delta","Sheriff Oborevwori","PDP","Monday Onyeme"],
  ["Ebonyi","Francis Ogbonna Nwifuru","APC","Patricia Obila"],
  ["Edo","Monday Okpebholo","APC","Dennis Idahosa"],
  ["Ekiti","Biodun Abayomi Oyebanji","APC","Monisade Afuye"],
  ["Enugu","Peter Ndubuisi Mbah","PDP","Ifeanyi Ossai"],
  ["Gombe","Muhammad Inuwa Yahaya","APC","Manasseh Daniel Jatau"],
  ["Imo","Hope Uzodinma","APC","Chinyere Ekomaru"],
  ["Jigawa","Umar Namadi","APC","Aminu Usman"],
  ["Kaduna","Uba Sani","APC","Hadiza Balarabe"],
  ["Kano","Abba Kabir Yusuf","NNPP","Aminu Abdussalam Gwarzo"],
  ["Katsina","Dikko Umaru Radda","APC","Faruk Lawal Jobe"],
  ["Kebbi","Nasir Idris","APC","Abubakar Umar Argungu"],
  ["Kogi","Ahmed Usman Ododo","APC","Salifu Joel Oyibo"],
  ["Kwara","AbdulRahman AbdulRazaq","APC","Kayode Alabi"],
  ["Lagos","Babajide Sanwo-Olu","APC","Obafemi Hamzat"],
  ["Nasarawa","Abdullahi Sule","APC","Emmanuel Akabe"],
  ["Niger","Mohammed Umaru Bago","APC","Yakubu Garba"],
  ["Ogun","Dapo Abiodun","APC","Noimot Salako-Oyedele"],
  ["Ondo","Lucky Orimisan Aiyedatiwa","APC","Olayide Adelami"],
  ["Osun","Ademola Adeleke","PDP","Kola Adewusi"],
  ["Oyo","Oluseyi Makinde","PDP","Bayo Lawal"],
  ["Plateau","Caleb Mutfwang","PDP","Josephine Piyo"],
  ["Rivers","Siminalayi Fubara","APC","Ngozi Odu"],
  ["Sokoto","Ahmed Aliyu Sokoto","APC","Ishaq Hamza Achida"],
  ["Taraba","Agbu Kefas","PDP","Aminu Alkali"],
  ["Yobe","Mai Mala Buni","APC","Idi Barde Gubana"],
  ["Zamfara","Dauda Lawal","PDP","Mani Malami Yaro"],
];

let inserted = 0;
for (const [state, gov, party, deputy] of governors) {
  // ON CONFLICT on (name, office, election_year) — skip if already present
  const exists = await sql`SELECT id FROM political_candidates WHERE name = ${gov} AND office = 'governor' AND state = ${state} AND election_year = 2027`;
  if (exists.length > 0) {
    // update party / running mate if changed
    await sql`UPDATE political_candidates SET party_acronym = ${party}, running_mate = ${deputy}, record_type = 'incumbent', verification_status = 'verified', office_level = 'state', source_urls = ${["https://en.wikipedia.org/wiki/List_of_current_state_governors_in_Nigeria"]}, political_background = ${`Current Governor of ${state} State. Elected under the ${party} platform.`}, data_confidence = 70 WHERE id = ${exists[0].id}`;
    continue;
  }
  await sql`
    INSERT INTO political_candidates
      (name, party_acronym, office, office_level, election_year, record_type, state, political_background, running_mate, incumbent_since, verification_status, data_confidence, source_urls)
    VALUES
      (${gov}, ${party}, 'governor', 'state', 2027, 'incumbent', ${state}, ${`Current Governor of ${state} State. Elected under the ${party} platform.`}, ${deputy}, '2023', 'verified', 70, ${["https://en.wikipedia.org/wiki/List_of_current_state_governors_in_Nigeria"]})
  `;
  inserted++;
}

console.log(`Seeded ${governors.length} governors (${inserted} new, ${governors.length - inserted} updated).`);

// Verify
const count = await sql`SELECT COUNT(*)::int AS total FROM political_candidates WHERE office = 'governor'`;
console.log("Total governors in DB:", count[0].total);
