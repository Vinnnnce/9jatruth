/**
 * Extended African and international regions for search and filtering.
 * Includes all African countries, major cities, and key international regions.
 */

export interface CountryData {
  name: string;
  code: string;
  regions: string[];
  majorCities: string[];
}

export const AFRICAN_COUNTRIES: CountryData[] = [
  {
    name: "Nigeria",
    code: "NG",
    regions: ["North Central", "North East", "North West", "South East", "South South", "South West"],
    majorCities: ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt", "Benin City", "Kaduna", "Enugu", "Onitsha", "Aba"],
  },
  {
    name: "Ghana",
    code: "GH",
    regions: ["Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Northern", "Upper East", "Upper West", "Volta", "Bono"],
    majorCities: ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast", "Tema", "Sunyani", "Bolgatanga"],
  },
  {
    name: "Kenya",
    code: "KE",
    regions: ["Nairobi", "Central", "Coast", "Eastern", "Nyanza", "Rift Valley", "Western", "North Eastern"],
    majorCities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Malindi", "Kitale", "Garissa"],
  },
  {
    name: "South Africa",
    code: "ZA",
    regions: ["Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga", "Northern Cape", "North West"],
    majorCities: ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London", "Polokwane"],
  },
  {
    name: "Egypt",
    code: "EG",
    regions: ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Red Sea", "Sinai", "Delta"],
    majorCities: ["Cairo", "Alexandria", "Giza", "Luxor", "Aswan", "Port Said", "Suez", "Mansoura"],
  },
  {
    name: "Uganda",
    code: "UG",
    regions: ["Central", "Eastern", "Northern", "Western"],
    majorCities: ["Kampala", "Entebbe", "Jinja", "Gulu", "Mbarara", "Mbale", "Masaka"],
  },
  {
    name: "Tanzania",
    code: "TZ",
    regions: ["Dar es Salaam", "Dodoma", "Arusha", "Mwanza", "Zanzibar", "Tanga", "Mbeya"],
    majorCities: ["Dar es Salaam", "Dodoma", "Arusha", "Mwanza", "Zanzibar City", "Tanga", "Mbeya"],
  },
  {
    name: "Ethiopia",
    code: "ET",
    regions: ["Addis Ababa", "Oromia", "Amhara", "Tigray", "Somali", "Southern Nations"],
    majorCities: ["Addis Ababa", "Dire Dawa", "Gondar", "Mekelle", "Bahir Dar", "Hawassa", "Jimma"],
  },
  {
    name: "Senegal",
    code: "SN",
    regions: ["Dakar", "Thies", "Saint-Louis", "Diourbel", "Kaolack", "Ziguinchor"],
    majorCities: ["Dakar", "Touba", "Thies", "Saint-Louis", "Kaolack", "Ziguinchor"],
  },
  {
    name: "Cameroon",
    code: "CM",
    regions: ["Centre", "Littoral", "South West", "North West", "West", "South", "East", "North", "Far North", "Adamawa"],
    majorCities: ["Douala", "Yaoundé", "Bamenda", "Bafoussam", "Garoua", "Maroua"],
  },
  {
    name: "Ivory Coast",
    code: "CI",
    regions: ["Abidjan", "Bas-Sassandra", "Yamoussoukro", "Savanes", "Vallée du Bandama"],
    majorCities: ["Abidjan", "Bouaké", "Yamoussoukro", "Daloa", "San-Pédro", "Korhogo"],
  },
  {
    name: "Rwanda",
    code: "RW",
    regions: ["Kigali", "Northern", "Southern", "Eastern", "Western"],
    majorCities: ["Kigali", "Butare", "Gitarama", "Ruhengeri", "Gisenyi"],
  },
  {
    name: "Morocco",
    code: "MA",
    regions: ["Casablanca-Settat", "Rabat-Salé-Kénitra", "Marrakech-Safi", "Fès-Meknès", "Tanger-Tétouan"],
    majorCities: ["Casablanca", "Rabat", "Marrakech", "Fès", "Tangier", "Agadir", "Meknès"],
  },
  {
    name: "Zimbabwe",
    code: "ZW",
    regions: ["Harare", "Bulawayo", "Manicaland", "Mashonaland", "Matabeleland", "Midlands"],
    majorCities: ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe"],
  },
  {
    name: "Zambia",
    code: "ZM",
    regions: ["Lusaka", "Copperbelt", "Central", "Southern", "Northern", "Eastern", "Western"],
    majorCities: ["Lusaka", "Ndola", "Kitwe", "Kabwe", "Livingstone", "Chipata"],
  },
  {
    name: "Malawi",
    code: "MW",
    regions: ["Central", "Northern", "Southern"],
    majorCities: ["Lilongwe", "Blantyre", "Mzuzu", "Zomba", "Kasungu"],
  },
  {
    name: "Mozambique",
    code: "MZ",
    regions: ["Maputo", "Gaza", "Inhambane", "Sofala", "Manica", "Tete", "Nampula", "Cabo Delgado"],
    majorCities: ["Maputo", "Matola", "Beira", "Nampula", "Chimoio", "Quelimane", "Tete"],
  },
  {
    name: "Botswana",
    code: "BW",
    regions: ["Gaborone", "Central", "Kgalagadi", "Kweneng", "North West", "North East"],
    majorCities: ["Gaborone", "Francistown", "Molepolole", "Maun", "Serowe"],
  },
  {
    name: "Namibia",
    code: "NA",
    regions: ["Karas", "Hardap", "Erongo", "Khomas", "Otjozondjupa", "Oshikoto", "Ohangwena"],
    majorCities: ["Windhoek", "Walvis Bay", "Swakopmund", "Oshakati", "Rundu"],
  },
  {
    name: "Sierra Leone",
    code: "SL",
    regions: ["Western Area", "Northern", "Southern", "Eastern"],
    majorCities: ["Freetown", "Bo", "Kenema", "Makeni", "Koidu"],
  },
  {
    name: "Liberia",
    code: "LR",
    regions: ["Montserrado", "Nimba", "Bong", "Grand Bassa", "Lofa"],
    majorCities: ["Monrovia", "Gbarnga", "Kakata", "Bensonville", "Harper"],
  },
  {
    name: "Togo",
    code: "TG",
    regions: ["Maritime", "Plateaux", "Centrale", "Kara", "Savanes"],
    majorCities: ["Lomé", "Sokodé", "Kara", "Atakpamé", "Dapaong"],
  },
  {
    name: "Benin",
    code: "BJ",
    regions: ["Littoral", "Atlantique", "Ouémé", "Plateau", "Borgou", "Alibori"],
    majorCities: ["Cotonou", "Porto-Novo", "Parakou", "Djougou", "Bohicon"],
  },
  {
    name: " Burkina Faso",
    code: "BF",
    regions: ["Centre", "Boucle du Mouhoun", "Est", "Hauts-Bassins", "Nord", "Plateau-Central", "Sahel"],
    majorCities: ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Banfora", "Ouahigouya"],
  },
  {
    name: "Mali",
    code: "ML",
    regions: ["Bamako", "Gao", "Kayes", "Mopti", "Ségou", "Sikasso", "Tombouctou"],
    majorCities: ["Bamako", "Sikasso", "Ségou", "Kayes", "Mopti", "Gao"],
  },
  {
    name: "Niger",
    code: "NE",
    regions: ["Niamey", "Agadez", "Diffa", "Dosso", "Maradi", "Tahoua", "Tillabéri", "Zinder"],
    majorCities: ["Niamey", "Zinder", "Maradi", "Agadez", "Tahoua"],
  },
  {
    name: "Chad",
    code: "TD",
    regions: ["N'Djamena", "Batha", "Borkou", "Chari-Baguirmi", "Hadjer-Lamis", "Kanem", "Lac"],
    majorCities: ["N'Djamena", "Moundou", "Sarh", "Abéché", "Kelo"],
  },
  {
    name: "Sudan",
    code: "SD",
    regions: ["Khartoum", "Red Sea", "River Nile", "Northern", "North Darfur", "South Darfur"],
    majorCities: ["Khartoum", "Omdurman", "Port Sudan", "Kassala", "Nyala", "El Obeid"],
  },
  {
    name: "South Sudan",
    code: "SS",
    regions: ["Central Equatoria", "Eastern Equatoria", "Jonglei", "Lakes", "Northern Bahr el Ghazal", "Unity", "Western Equatoria"],
    majorCities: ["Juba", "Bor", "Malakal", "Wau", "Yei"],
  },
  {
    name: "Somalia",
    code: "SO",
    regions: ["Banadir", "Bakool", "Bari", "Galguduud", "Gedo", "Hiran", "Lower Juba", "Mudug"],
    majorCities: ["Mogadishu", "Hargeisa", "Bosaso", "Galkayo", "Kismayo"],
  },
  {
    name: "Djibouti",
    code: "DJ",
    regions: ["Djibouti", "Ali Sabieh", "Arta", "Dikhil", "Obock", "Tadjourah"],
    majorCities: ["Djibouti City", "Ali Sabieh", "Tadjoura", "Obock", "Dikhil"],
  },
  {
    name: "Eritrea",
    code: "ER",
    regions: ["Central", "Southern", "Gash-Barka", "Anseba", "Northern Red Sea", "Southern Red Sea"],
    majorCities: ["Asmara", "Keren", "Assab", "Massawa", "Mendefera"],
  },
  {
    name: "Madagascar",
    code: "MG",
    regions: ["Antananarivo", "Antsiranana", "Fianarantsoa", "Mahajanga", "Toamasina", "Toliara"],
    majorCities: ["Antananarivo", "Toamasina", "Antsirabe", "Fianarantsoa", "Mahajanga"],
  },
  {
    name: "Mauritius",
    code: "MU",
    regions: ["Port Louis", "Pamplemousses", "Rivière du Rempart", "Flacq", "Grand Port", "Plaines Wilhems"],
    majorCities: ["Port Louis", "Curepipe", "Vacoas", "Quatre Bornes", "Rose Hill"],
  },
  {
    name: "The Gambia",
    code: "GM",
    regions: ["Banjul", "Kanifing", "Brikama", "Mansakonko", "Kerewan", "Kuntaur", "Janjanbureh", "Basse"],
    majorCities: ["Serekunda", "Brikama", "Banjul", "Bakau", "Farafenni"],
  },
  {
    name: "Guinea",
    code: "GN",
    regions: ["Conakry", "Boké", "Faranah", "Kankan", "Kindia", "Labé", "Mamou", "Nzérékoré"],
    majorCities: ["Conakry", "Nzérékoré", "Kankan", "Kindia", "Boké"],
  },
  {
    name: "Gabon",
    code: "GA",
    regions: ["Estuaire", "Haut-Ogooué", "Moyen-Ogooué", "Ngounié", "Nyanga", "Ogooué-Ivindo", "Ogooué-Lolo", "Ogooué-Maritime"],
    majorCities: ["Libreville", "Port-Gentil", "Franceville", "Oyem", "Moanda"],
  },
  {
    name: "Congo (DRC)",
    code: "CD",
    regions: ["Kinshasa", "Kongo Central", "Kwango", "Kwilu", "Mai-Ndombe", "Kasai", "Haut-Katanga", "Lualaba", "North Kivu", "South Kivu"],
    majorCities: ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Goma", "Bukavu", "Kananga", "Kisangani"],
  },
  {
    name: "Congo (Republic)",
    code: "CG",
    regions: ["Brazzaville", "Kouilou", "Niari", "Bouenza", "Lékoumou", "Pool", "Plateaux", "Cuvette", "Sangha"],
    majorCities: ["Brazzaville", "Pointe-Noire", "Dolisie", "Nkayi", "Impfondo"],
  },
  {
    name: "Equatorial Guinea",
    code: "GQ",
    regions: ["Bioko Norte", "Bioko Sur", "Centro Sur", "Kie-Ntem", "Litoral", "Wele-Nzas", "Annobón"],
    majorCities: ["Malabo", "Bata", "Ebebiyin", "Mongomo", "Evinayong"],
  },
  {
    name: "São Tomé and Príncipe",
    code: "ST",
    regions: ["São Tomé", "Príncipe"],
    majorCities: ["São Tomé", "Trindade", "Neves", "Santana"],
  },
  {
    name: "Cape Verde",
    code: "CV",
    regions: ["Santiago", "São Vicente", "Santo Antão", "Fogo", "Brava", "Sal", "Boa Vista", "Maio", "Nicolau"],
    majorCities: ["Praia", "Mindelo", "Santa Maria", "Espargos", "Assomada"],
  },
  {
    name: "Comoros",
    code: "KM",
    regions: ["Grande Comore", "Anjouan", "Mohéli"],
    majorCities: ["Moroni", "Mutsamudu", "Fomboni", "Domoni"],
  },
  {
    name: "Seychelles",
    code: "SC",
    regions: ["Mahé", "Praslin", "La Digue"],
    majorCities: ["Victoria", "Anse Royale", "Baie Lazare", "Praslin"],
  },
  {
    name: "Burundi",
    code: "BI",
    regions: ["Bujumbura", "Bubanza", "Bujumbura Rural", "Bururi", "Cankuzo", "Cibitoke", "Gitega", "Karuzi"],
    majorCities: ["Bujumbura", "Gitega", "Muyinga", "Ruyigi", "Ngozi"],
  },
  {
    name: "Lesotho",
    code: "LS",
    regions: ["Berea", "Butha-Buthe", "Leribe", "Mafeteng", "Maseru", "Mohale's Hoek", "Qacha's Nek", "Quthing"],
    majorCities: ["Maseru", "Teyateyaneng", "Maputsoe", "Hlotse", "Mohale's Hoek"],
  },
  {
    name: "Eswatini",
    code: "SZ",
    regions: ["Hhohho", "Lubombo", "Manzini", "Shiselweni"],
    majorCities: ["Mbabane", "Manzini", "Big Bend", "Mhlume", "Siteki"],
  },
  {
    name: "Angola",
    code: "AO",
    regions: ["Luanda", "Benguela", "Huambo", "Huíla", "Namibe", "Cabinda", "Malanje", "Uíge"],
    majorCities: ["Luanda", "Huambo", "Benguela", "Lobito", "Lubango", "Malanje"],
  },
  {
    name: "Libya",
    code: "LY",
    regions: ["Tripoli", "Benghazi", "Misrata", "Zawiya", "Zliten", "Sirte", " Sabha"],
    majorCities: ["Tripoli", "Benghazi", "Misrata", "Zawiya", "Zliten"],
  },
  {
    name: "Tunisia",
    code: "TN",
    regions: ["Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan", "Bizerte", "Béja"],
    majorCities: ["Tunis", "Sfax", "Sousse", "Kairouan", "Bizerte", "Gabès"],
  },
  {
    name: "Algeria",
    code: "DZ",
    regions: ["Algiers", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Sétif"],
    majorCities: ["Algiers", "Oran", "Constantine", "Annaba", "Blida", "Batna"],
  },
];

export const INTERNATIONAL_REGIONS: CountryData[] = [
  {
    name: "United States",
    code: "US",
    regions: ["Northeast", "Southeast", "Midwest", "Southwest", "West Coast", "Pacific Northwest"],
    majorCities: ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego"],
  },
  {
    name: "United Kingdom",
    code: "GB",
    regions: ["England", "Scotland", "Wales", "Northern Ireland"],
    majorCities: ["London", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Bristol"],
  },
  {
    name: "Canada",
    code: "CA",
    regions: ["Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", "Nova Scotia"],
    majorCities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton", "Winnipeg"],
  },
  {
    name: "Australia",
    code: "AU",
    regions: ["New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania"],
    majorCities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Hobart"],
  },
  {
    name: "Germany",
    code: "DE",
    regions: ["Bavaria", "Berlin", "Hamburg", "Hesse", "Lower Saxony", "North Rhine-Westphalia"],
    majorCities: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf"],
  },
  {
    name: "France",
    code: "FR",
    regions: ["Île-de-France", "Provence-Alpes-Côte d'Azur", "Auvergne-Rhône-Alpes", "Occitanie", "Nouvelle-Aquitaine"],
    majorCities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg"],
  },
  {
    name: "United Arab Emirates",
    code: "AE",
    regions: ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"],
    majorCities: ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman"],
  },
  {
    name: "China",
    code: "CN",
    regions: ["Beijing", "Shanghai", "Guangdong", "Zhejiang", "Jiangsu", "Sichuan", "Hubei"],
    majorCities: ["Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu", "Wuhan", "Hangzhou"],
  },
  {
    name: "India",
    code: "IN",
    regions: ["Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "West Bengal", "Gujarat", "Telangana"],
    majorCities: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad"],
  },
  {
    name: "Brazil",
    code: "BR",
    regions: ["São Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia", "Paraná", "Rio Grande do Sul"],
    majorCities: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Recife"],
  },
  {
    name: "Japan",
    code: "JP",
    regions: ["Tokyo", "Osaka", "Aichi", "Kanagawa", "Hokkaido", "Fukuoka", "Kyoto"],
    majorCities: ["Tokyo", "Osaka", "Nagoya", "Yokohama", "Sapporo", "Fukuoka", "Kyoto"],
  },
  {
    name: "South Korea",
    code: "KR",
    regions: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju"],
    majorCities: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju"],
  },
  {
    name: "Singapore",
    code: "SG",
    regions: ["Central Region", "East Region", "North Region", "North-East Region", "West Region"],
    majorCities: ["Singapore", "Jurong", "Tampines", "Woodlands", "Bedok"],
  },
  {
    name: "Saudi Arabia",
    code: "SA",
    regions: ["Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk"],
    majorCities: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar"],
  },
  {
    name: "Qatar",
    code: "QA",
    regions: ["Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Umm Salal"],
    majorCities: ["Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Lusail"],
  },
  {
    name: "Turkey",
    code: "TR",
    regions: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana"],
    majorCities: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Konya"],
  },
  {
    name: "Russia",
    code: "RU",
    regions: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Nizhny Novgorod"],
    majorCities: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan", "Nizhny Novgorod"],
  },
  {
    name: "Italy",
    code: "IT",
    regions: ["Lazio", "Lombardy", "Campania", "Sicily", "Veneto", "Tuscany", "Piedmont"],
    majorCities: ["Rome", "Milan", "Naples", "Turin", "Palermo", "Florence", "Venice"],
  },
  {
    name: "Spain",
    code: "ES",
    regions: ["Madrid", "Catalonia", "Andalusia", "Valencia", "Galicia", "Basque Country"],
    majorCities: ["Madrid", "Barcelona", "Valencia", "Seville", "Bilbao", "Málaga", "Zaragoza"],
  },
  {
    name: "Netherlands",
    code: "NL",
    regions: ["North Holland", "South Holland", "Utrecht", "North Brabant", "Gelderland"],
    majorCities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
  },
  {
    name: "Sweden",
    code: "SE",
    regions: ["Stockholm", "Västra Götaland", "Skåne", "Uppsala", "Gävleborg"],
    majorCities: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Västerås"],
  },
  {
    name: "Switzerland",
    code: "CH",
    regions: ["Zurich", "Geneva", "Basel", "Bern", "Vaud", "Ticino"],
    majorCities: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne", "Winterthur"],
  },
  {
    name: "Ireland",
    code: "IE",
    regions: ["Leinster", "Munster", "Connacht", "Ulster"],
    majorCities: ["Dublin", "Cork", "Galway", "Limerick", "Waterford"],
  },
  {
    name: "Portugal",
    code: "PT",
    regions: ["Lisbon", "Porto", "Algarve", "Centro", "Norte"],
    majorCities: ["Lisbon", "Porto", "Braga", "Faro", "Coimbra"],
  },
  {
    name: "Mexico",
    code: "MX",
    regions: ["Mexico City", "Jalisco", "Nuevo León", "Puebla", "Veracruz", "Baja California"],
    majorCities: ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León"],
  },
  {
    name: "Argentina",
    code: "AR",
    regions: ["Buenos Aires", "Córdoba", "Santa Fe", "Mendoza", "Tucumán"],
    majorCities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata"],
  },
  {
    name: "Chile",
    code: "CL",
    regions: ["Santiago", "Valparaíso", "Biobío", "Araucanía", "Antofagasta"],
    majorCities: ["Santiago", "Valparaíso", "Concepción", "Antofagasta", "Viña del Mar"],
  },
  {
    name: "Colombia",
    code: "CO",
    regions: ["Bogotá", "Antioquia", "Valle del Cauca", "Atlántico", "Santander"],
    majorCities: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"],
  },
  {
    name: "Peru",
    code: "PE",
    regions: ["Lima", "Arequipa", "La Libertad", "Cusco", "Piura"],
    majorCities: ["Lima", "Arequipa", "Trujillo", "Cusco", "Chiclayo"],
  },
  {
    name: "Indonesia",
    code: "ID",
    regions: ["Jakarta", "West Java", "East Java", "Central Java", "Banten", "Bali"],
    majorCities: ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Denpasar"],
  },
  {
    name: "Malaysia",
    code: "MY",
    regions: ["Kuala Lumpur", "Selangor", "Johor", "Penang", "Sabah", "Sarawak"],
    majorCities: ["Kuala Lumpur", "George Town", "Johor Bahru", "Ipoh", "Kuching", "Kota Kinabalu"],
  },
  {
    name: "Thailand",
    code: "TH",
    regions: ["Bangkok", "Chiang Mai", "Phuket", "Nonthaburi", "Pattaya"],
    majorCities: ["Bangkok", "Chiang Mai", "Phuket", "Nonthaburi", "Pattaya", "Khon Kaen"],
  },
  {
    name: "Philippines",
    code: "PH",
    regions: ["Metro Manila", "Cebu", "Davao", "Calabarzon", "Ilocos"],
    majorCities: ["Manila", "Quezon City", "Cebu City", "Davao", "Makati", "Baguio"],
  },
  {
    name: "Vietnam",
    code: "VN",
    regions: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho"],
    majorCities: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho", "Hue"],
  },
  {
    name: "Bangladesh",
    code: "BD",
    regions: ["Dhaka", "Chittagong", "Rajshahi", "Khulna", "Sylhet"],
    majorCities: ["Dhaka", "Chittagong", "Khulna", "Sylhet", "Rajshahi"],
  },
  {
    name: "Pakistan",
    code: "PK",
    regions: ["Sindh", "Punjab", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory"],
    majorCities: ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Rawalpindi", "Peshawar"],
  },
  {
    name: "Nigeria Diaspora - US",
    code: "NG-US",
    regions: ["Texas", "Maryland", "New York", "Georgia", "Illinois", "California"],
    majorCities: ["Houston", "Baltimore", "New York City", "Atlanta", "Chicago", "Los Angeles"],
  },
  {
    name: "Nigeria Diaspora - UK",
    code: "NG-UK",
    regions: ["Greater London", "Manchester", "Birmingham", "Leeds", "Glasgow"],
    majorCities: ["London", "Manchester", "Birmingham", "Leeds", "Glasgow"],
  },
  {
    name: "Nigeria Diaspora - Canada",
    code: "NG-CA",
    regions: ["Ontario", "Alberta", "British Columbia", "Quebec", "Manitoba"],
    majorCities: ["Toronto", "Calgary", "Vancouver", "Montreal", "Winnipeg"],
  },
];

export const ALL_COUNTRIES = [...AFRICAN_COUNTRIES, ...INTERNATIONAL_REGIONS];

/**
 * Search for regions/cities by query string.
 */
export function searchRegions(query: string): Array<{ country: string; region: string; city?: string }> {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const results: Array<{ country: string; region: string; city?: string }> = [];

  for (const country of ALL_COUNTRIES) {
    if (country.name.toLowerCase().includes(q)) {
      results.push({ country: country.name, region: country.name });
    }
    for (const region of country.regions) {
      if (region.toLowerCase().includes(q)) {
        results.push({ country: country.name, region });
      }
    }
    for (const city of country.majorCities) {
      if (city.toLowerCase().includes(q)) {
        results.push({ country: country.name, region: city, city });
      }
    }
  }

  return results.slice(0, 20);
}
