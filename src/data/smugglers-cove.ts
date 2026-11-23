/**
 * The Smuggler's Cove rum classification: 21 categories by raw material,
 * still and age, 8 of them numbered for the book's recipes (the book
 * suggests writing the number on tape on each bottle's neck).
 *
 * Source: Martin & Rebecca Cate, "Smuggler's Cove: Exotic Cocktails, Rum,
 * and the Cult of Tiki" (Ten Speed Press, 2016), rum list on pp. 197-199,
 * transcribed from John's copy. Bottles are as listed in 2016 (some have
 * since been renamed, e.g. Plantation is now Planteray -- `match` covers
 * the renames we're sure of). Spelling fixes vs the printed list: "Ron
 * Centenario" (printed "Cenenario"), "Scarlet Ibis" (printed "Scarlett").
 *
 * `match`: lower-case phrases (see normalizeBottle in src/lib/rum-numbers.ts)
 * that identify the bottle in a free-text bottle name; the longest match wins.
 */

export const SC_SOURCE = {
  title: "Smuggler's Cove: Exotic Cocktails, Rum, and the Cult of Tiki",
  authors: "Martin & Rebecca Cate",
  year: 2016,
  pages: "197–199",
  url: "https://www.smugglerscovesf.com/",
} as const;

export type ScGroup = "molasses" | "cane";

export interface ScBottle {
  /** As listed in the book. */
  label: string;
  region: string;
  match: string[];
}

export interface ScCategory {
  id: string;
  /** The book's number (1-8) for the categories its recipes call for. */
  number: number | null;
  name: string;
  group: ScGroup;
  page: number;
  bottles: ScBottle[];
}

export const SC_GROUPS: { id: ScGroup; label: string }[] = [
  { id: "molasses", label: "Molasses and evaporated cane rums" },
  { id: "cane", label: "Fresh cane juice rums" },
];

const b = (label: string, region: string, ...match: string[]): ScBottle => ({ label, region, match });

export const SC_CATEGORIES: ScCategory[] = [
  {
    id: "pot-still-unaged",
    number: null,
    name: "Pot still unaged",
    group: "molasses",
    page: 197,
    bottles: [
      b("Hamilton Jamaica Gold", "Jamaica", "hamilton jamaica gold", "hamilton jamaican pot still gold"),
      b("Owney's New York Rum", "New York, USA", "owneys"),
      b("Pritchard's Crystal", "Tennessee, USA", "pritchards crystal"),
      b("Privateer Silver Reserve", "Massachusetts, USA", "privateer silver"),
      b("Rum Society #40 and #62", "Guyana; regional blend", "rum society 40", "rum society 62"),
      b("Sammy's Beach Bar Rum", "Hawaii, USA", "sammys beach bar"),
      b("Sergeant Classick White", "California, USA", "sergeant classick"),
      b("Wray & Nephew (overproof)", "Jamaica", "wray and nephew"),
    ],
  },
  {
    id: "pot-still-lightly-aged",
    number: 1,
    name: "Pot still lightly aged",
    group: "molasses",
    page: 197,
    bottles: [
      b("Ballast Point Three Sheets Aged", "California, USA", "three sheets aged", "ballast point three sheets"),
      b("Diablo's Shadow Navy Strength (overproof)", "California, USA", "diablos shadow"),
      b("House Spirits Aged Rum", "Oregon, USA", "house spirits aged"),
      b("Journeyman Road's End Organic Rum (overproof)", "Michigan, USA", "journeyman roads end", "roads end"),
      b("Maggie's Farm Queen's Share Rum (overproof)", "Pennsylvania, USA", "maggies farm queens share", "queens share"),
      b("Montanya Oro and Platino", "Colorado, USA", "montanya oro", "montanya platino"),
      b("Pritchard's Fine", "Tennessee, USA", "pritchards fine"),
      b("Privateer Amber", "Massachusetts, USA", "privateer amber"),
      b("Ragged Mountain Rum", "Massachusetts, USA", "ragged mountain"),
      b("Richland Georgia Rum", "Georgia, USA", "richland"),
      b("Rum Society #65", "regional blend", "rum society 65"),
      b("Smith & Cross (overproof)", "Jamaica", "smith and cross"),
      b("Sun Rum Barrel Aged", "Washington, USA", "sun rum barrel aged"),
      b("Thomas Tew Single Barrel", "Rhode Island, USA", "thomas tew"),
    ],
  },
  {
    id: "pot-still-aged",
    number: null,
    name: "Pot still aged",
    group: "molasses",
    page: 197,
    bottles: [
      b("Berry Bros & Rudd", "independent bottler, various", "berry bros", "berry brothers"),
      b("Cadenhead", "independent bottler, various", "cadenhead", "cadenheads"),
      b("Duncan Taylor", "independent bottler, various", "duncan taylor"),
      b("El Dorado Single Barrel PM", "Guyana", "el dorado single barrel pm", "el dorado pm"),
      b("Hamilton St. Lucia", "St. Lucia", "hamilton st lucia", "hamilton saint lucia"),
      b("Mezan", "independent bottler, various", "mezan"),
      b("Plantation", "independent bottler, various"),
      b("Samaroli", "independent bottler, various", "samaroli"),
      b("St. Nicholas Abbey 5 Year", "Barbados", "st nicholas abbey 5", "saint nicholas abbey 5"),
    ],
  },
  {
    id: "pot-still-long-aged",
    number: null,
    name: "Pot still long aged",
    group: "molasses",
    page: 197,
    bottles: [
      b("Appleton Estate 50 Year", "Jamaica", "appleton estate 50", "appleton 50"),
      b("Diplomático Ambassador and Single Vintage", "Venezuela", "diplomatico ambassador", "diplomatico single vintage"),
      b("The Black Tot", "regional blend", "black tot"),
    ],
  },
  {
    id: "blended-lightly-aged",
    number: 2,
    name: "Blended lightly aged",
    group: "molasses",
    page: 197,
    bottles: [
      b("Appleton Estate Signature Blend", "Jamaica", "appleton estate signature", "appleton signature"),
      b("Banks 5 Island and 7 Island", "regional blend", "banks 5", "banks 7"),
      b("Cartavio Selecto 5", "Peru", "cartavio selecto 5", "cartavio 5"),
      b("Chairman's Reserve Silver", "St. Lucia", "chairmans reserve silver"),
      b("Cockspur Fine", "Barbados", "cockspur fine"),
      b("Denizen", "regional blend", "denizen aged white", "denizen white", "denizen rum"),
      b("Diplomático Añejo and Blanco", "Venezuela", "diplomatico anejo", "diplomatico blanco"),
      b("El Dorado 3 Year", "Guyana", "el dorado 3"),
      b("Mount Gay Eclipse", "Barbados", "mount gay eclipse"),
      b("Plantation 3 Star (now Planteray 3 Stars)", "regional blend", "plantation 3 star", "plantation 3 stars", "planteray 3 star", "planteray 3 stars"),
      b("Real McCoy 3 Year", "Barbados", "real mccoy 3"),
      b("Santa Teresa Claro", "Venezuela", "santa teresa claro"),
    ],
  },
  {
    id: "blended-aged",
    number: 3,
    name: "Blended aged",
    group: "molasses",
    page: 197,
    bottles: [
      b(
        "Appleton Estate Reserve Blend (now 8 Year Reserve) and Rare Blend 12",
        "Jamaica",
        "appleton estate reserve",
        "appleton reserve",
        "appleton estate 8",
        "appleton 8",
        "appleton estate rare blend",
        "appleton rare blend",
        "appleton estate 12",
        "appleton 12"
      ),
      b("Cadenhead Green Label", "regional blend", "cadenhead green label", "cadenheads green label"),
      b("Cartavio Selecto 12 and 18", "Peru", "cartavio selecto 12", "cartavio selecto 18"),
      b("Chairman's Reserve and Forgotten Casks", "St. Lucia", "chairmans reserve", "chairmans reserve original", "chairmans reserve forgotten casks"),
      b("Cockspur 12", "Barbados", "cockspur 12"),
      b("Denizen Merchant's Reserve", "regional blend", "denizen merchants reserve"),
      b("Diplomático Reserva and Reserva Exclusiva", "Venezuela", "diplomatico reserva", "diplomatico reserva exclusiva"),
      b("Doorly's 5 Year, 12 Year, and XO", "Barbados", "doorlys 5", "doorlys 12", "doorlys xo"),
      b("Dos Maderas 5+3 and 5+5", "regional blend", "dos maderas 5 3", "dos maderas 5 5", "dos maderas px 5 5"),
      b("El Dorado 5 Year, 8 Year, and 12 Year", "Guyana", "el dorado 5", "el dorado 8", "el dorado 12"),
      b("Kaniché XO", "Barbados", "kaniche xo"),
      b("Mount Gay Black Barrel and XO", "Barbados", "mount gay black barrel", "mount gay xo"),
      b(
        "Plantation 5 Year Grand Reserve and 20th Anniversary",
        "Barbados",
        "plantation 5 grand reserve",
        "plantation grand reserve",
        "planteray grand reserve",
        "plantation 20 th anniversary",
        "planteray 20 th anniversary"
      ),
      b("Providencia", "regional blend", "providencia"),
      b("Pusser's", "regional blend", "pussers"),
      b("Real McCoy 5 Year and 12 Year", "Barbados", "real mccoy 5", "real mccoy 12"),
      b("RL Seale 9 Year Port Cask Finish and 10 Year", "Barbados", "rl seale 9", "rl seale 10", "rl seales 9", "rl seales 10"),
    ],
  },
  {
    id: "blended-long-aged",
    number: null,
    name: "Blended long aged",
    group: "molasses",
    page: 198,
    bottles: [
      b("Appleton Estate 21", "Jamaica", "appleton estate 21", "appleton 21"),
      b("Banks The Endeavour", "regional blend", "banks the endeavour", "banks endeavour"),
      b("Cartavio XO", "Peru", "cartavio xo"),
      b("El Dorado 15 Year, 21 Year, and 25 Year", "Guyana", "el dorado 15", "el dorado 21", "el dorado 25"),
      b("Mount Gay 1703", "Barbados", "mount gay 1703"),
      b("Pusser's 15", "regional blend", "pussers 15"),
      b("Santa Teresa 1796", "Venezuela", "santa teresa 1796"),
      b("Smooth Ambler Revelation Rum", "Jamaica", "smooth ambler revelation"),
      b("St. Lucia Distillers 1931", "St. Lucia", "st lucia distillers 1931", "chairmans reserve 1931"),
    ],
  },
  {
    id: "column-still-lightly-aged",
    number: null,
    name: "Column still lightly aged",
    group: "molasses",
    page: 198,
    bottles: [
      b("Bacardi Heritage 1909", "Mexico", "bacardi heritage"),
      b("Caliche", "Puerto Rico", "caliche"),
      b("Caña Brava", "Panama", "cana brava"),
      b("Crusoe Organic White", "California, USA", "crusoe organic white"),
      b("Cruzan Estate Diamond", "U.S. Virgin Islands", "cruzan estate diamond"),
      b("Don Q Cristal", "Puerto Rico", "don q cristal"),
      b("Facundo Neo", "Bahamas/Puerto Rico", "facundo neo"),
      b("Flor de Caña Extra Dry 4 Year", "Nicaragua", "flor de cana extra dry"),
      b("Ron Del Barrilito 2 Star", "Puerto Rico", "barrilito 2 star", "barrilito 2 stars", "barrilito two star", "barrilito two stars"),
      b("Scarlet Ibis", "Trinidad", "scarlet ibis", "scarlett ibis"),
    ],
  },
  {
    id: "column-still-aged",
    number: 4,
    name: "Column still aged",
    group: "molasses",
    page: 198,
    bottles: [
      b("Admiral Rodney", "St. Lucia", "admiral rodney"),
      b("Angostura 1824, 1919, 5 Year, and 7 Year", "Trinidad", "angostura 1824", "angostura 1919", "angostura 5", "angostura 7"),
      b("Bacardi 8 and Reserva Limitada", "Bahamas/Puerto Rico", "bacardi 8", "bacardi ocho", "bacardi reserva ocho", "bacardi gran reserva ocho", "bacardi reserva limitada"),
      b("Brugal 1888 and Extra Viejo", "Dominican Republic", "brugal 1888", "brugal extra viejo"),
      b("Caña Brava 7 Year", "Panama", "cana brava 7"),
      b("Cruzan Single Barrel", "U.S. Virgin Islands", "cruzan single barrel"),
      b("Don Pancho Origines 8", "Panama", "don pancho origines 8", "don pancho 8"),
      b("Don Q Añejo and Gran Añejo", "Puerto Rico", "don q anejo", "don q gran anejo"),
      b("El Dorado Single Barrel EHP and Single Barrel ICBU", "Guyana", "el dorado single barrel ehp", "el dorado single barrel icbu", "el dorado ehp", "el dorado icbu"),
      b("English Harbour 5 and 10", "Antigua", "english harbour 5", "english harbour 10"),
      b("Facundo Eximo, Exquisito, and Paraiso", "Bahamas/Puerto Rico", "facundo eximo", "facundo exquisito", "facundo paraiso"),
      b("Flor de Caña 12", "Nicaragua", "flor de cana 12", "flor de cana centenario 12"),
      b("Kirk & Sweeney 12, 18, and 23", "Dominican Republic", "kirk and sweeney"),
      b("Ron Abuelo 12, 7, Centuria", "Panama", "abuelo 12", "abuelo 7", "abuelo centuria"),
      b("Ron Botran Reserva and Solera 1893", "Guatemala", "botran reserva", "botran solera"),
      b("Ron Centenario 9, 12, 20, and 25", "Costa Rica", "ron centenario 9", "ron centenario 12", "ron centenario 20", "ron centenario 25"),
      b("Ron Del Barrilito 3 Star", "Puerto Rico", "barrilito 3 star", "barrilito 3 stars", "barrilito three star", "barrilito three stars"),
      b("Ron Matusalem 15", "Dominican Republic", "matusalem 15"),
      b("Trigo", "Puerto Rico", "trigo"),
      b("Westerhall Plantation", "Grenada", "westerhall plantation"),
      b("Zacapa 23 and XO", "Guatemala", "zacapa 23", "zacapa xo", "zacapa centenario 23", "zacapa centenario xo"),
      b("Zafra", "Panama", "zafra"),
    ],
  },
  {
    id: "column-still-long-aged",
    number: null,
    name: "Column still long aged",
    group: "molasses",
    page: 198,
    bottles: [
      b("Don Pancho Origines 18 and 30", "Panama", "don pancho origines 18", "don pancho origines 30", "don pancho 18", "don pancho 30"),
      b("English Harbour 25", "Antigua", "english harbour 25"),
      b("Flor de Caña 18 and 25", "Nicaragua", "flor de cana 18", "flor de cana 25", "flor de cana centenario 18", "flor de cana centenario 25"),
      b("Reserva de la Familia Serrallés 20 Year Old", "Puerto Rico", "reserva de la familia serralles", "familia serralles"),
    ],
  },
  {
    id: "black-pot-still",
    number: null,
    name: "Black pot still",
    group: "molasses",
    page: 198,
    bottles: [b("Hamilton Jamaica Black", "Jamaica", "hamilton jamaica black", "hamilton jamaican black", "hamilton jamaican pot still black")],
  },
  {
    id: "black-blended",
    number: 5,
    name: "Black blended",
    group: "molasses",
    page: 198,
    bottles: [
      b("Coruba", "Jamaica", "coruba"),
      b("Goslings Black Seal", "regional blend", "goslings black seal", "goslings black"),
      b("Hamilton Guyana 86", "Guyana", "hamilton guyana 86", "hamilton 86", "hamilton demerara 86"),
      b("Kohala Bay", "Jamaica", "kohala bay"),
      b("Lemon Hart 80", "Guyana", "lemon hart 80"),
      b("Pampero Aniversario", "Venezuela", "pampero aniversario"),
      b("Newfoundland Screech", "Jamaica", "screech"),
      b("Blackwell's Black Gold", "Jamaica", "blackwells", "blackwell black gold"),
      b("Skipper Finest Old Demerara", "Guyana", "skipper"),
    ],
  },
  {
    id: "black-blended-overproof",
    number: 6,
    name: "Black blended overproof",
    group: "molasses",
    page: 198,
    bottles: [
      b("Hamilton Guyana 151", "Guyana", "hamilton guyana 151", "hamilton 151", "hamilton demerara 151"),
      b("Lemon Hart 151", "Guyana", "lemon hart 151"),
      b("Plantation O.F.T.D. (now Planteray O.F.T.D.)", "regional blend", "plantation oftd", "planteray oftd", "oftd"),
    ],
  },
  {
    id: "cane-coffey-still-aged",
    number: null,
    name: "Cane Coffey still aged",
    group: "cane",
    page: 199,
    bottles: [b("Rhum Barbancourt 5 Star and Estate Reserve", "Haiti", "barbancourt 5 star", "barbancourt five star", "barbancourt estate reserve")],
  },
  {
    id: "cane-pot-still-unaged",
    number: null,
    name: "Cane pot still unaged",
    group: "cane",
    page: 199,
    bottles: [
      b("Capovilla Agricole PMG", "Marie Galante", "capovilla agricole pmg", "capovilla pmg"),
      b("St. George California Agricole", "California, USA", "st george california agricole"),
    ],
  },
  {
    id: "cane-pot-still-aged",
    number: null,
    name: "Cane pot still aged",
    group: "cane",
    page: 199,
    bottles: [
      b("Capovilla Rhum Liberation 2010", "Marie Galante", "capovilla rhum liberation", "capovilla liberation"),
      b("St. George California Reserve Agricole", "California, USA", "st george california reserve agricole"),
    ],
  },
  {
    id: "agricole-blanc",
    number: 7,
    name: "Cane AOC Martinique rhum agricole blanc",
    group: "cane",
    page: 199,
    bottles: [
      b("Clément Première Canne and Canne Bleue", "Martinique", "clement premiere canne", "clement canne bleue"),
      b("Duquesne Blanc", "Martinique", "duquesne blanc"),
      b("La Favorite Blanc", "Martinique", "la favorite blanc"),
      b("Neisson Blanc, Le Rhum, and L'Esprit Overproof", "Martinique", "neisson blanc", "neisson le rhum", "neisson lesprit"),
      b("Rhum J.M White 100 proof", "Martinique", "rhum jm white", "rhum jm blanc", "jm blanc", "jm white"),
    ],
  },
  {
    id: "agricole-vieux",
    number: 8,
    name: "Cane AOC Martinique rhum agricole vieux",
    group: "cane",
    page: 199,
    bottles: [
      b("Clément V.S.O.P., 6 Year Très Vieux, and 10 Year Très Vieux", "Martinique", "clement vsop", "clement 6", "clement 10", "clement tres vieux"),
      b("Duquesne Élevé Sous Bois", "Martinique", "duquesne eleve sous bois"),
      b("La Favorite Coeur de Ambré and Vieux", "Martinique", "la favorite coeur dambre", "la favorite coeur de ambre", "la favorite vieux"),
      b("Neisson Élevé Sous Bois and Réserve Spéciale", "Martinique", "neisson eleve sous bois", "neisson reserve speciale"),
      b("Rhum J.M E.S.B. Gold and V.S.O.P.", "Martinique", "rhum jm esb", "rhum jm gold", "rhum jm vsop", "jm vsop"),
    ],
  },
  {
    id: "agricole-long-aged",
    number: null,
    name: "Cane AOC Martinique rhum agricole long aged",
    group: "cane",
    page: 199,
    bottles: [
      b("Clément Cuvée Homère", "Martinique", "clement cuvee homere"),
      b("Neisson 15 Year and 18 Year", "Martinique", "neisson 15", "neisson 18"),
      b("Rhum J.M 1994 and 1997", "Martinique", "rhum jm 1994", "rhum jm 1997"),
    ],
  },
  {
    id: "cachaca-unaged",
    number: null,
    name: "Pot still unaged cachaça",
    group: "cane",
    page: 199,
    bottles: [b("Avuá Prata", "Brazil", "avua prata"), b("Novo Fogo Silver", "Brazil", "novo fogo silver")],
  },
  {
    id: "cachaca-aged",
    number: null,
    name: "Pot still aged cachaça",
    group: "cane",
    page: 199,
    bottles: [b("Avuá Amburana", "Brazil", "avua amburana"), b("Novo Fogo Gold", "Brazil", "novo fogo gold")],
  },
];

/**
 * Our catalog's rum styles (src/data/ingredients.ts) -> the closest
 * Smuggler's Cove category. "book": the book lists this style's example
 * bottles there, or the category is defined by exactly this style (e.g.
 * AOC Martinique blanc); "closest": our judgment, shown as such.
 */
export const SC_STYLE_MAP: Record<string, { category: string; basis: "book" | "closest"; note: string }> = {
  "light-white-rum": {
    category: "column-still-lightly-aged",
    basis: "closest",
    note: "Most bottles here are column-still and lightly aged (the book lists Don Q Cristal there); Planteray 3 Stars is a ❷ blended lightly aged.",
  },
  "light-gold-rum": {
    category: "column-still-lightly-aged",
    basis: "closest",
    note: "Light column-still rums aged a few years.",
  },
  "aged-caribbean-rum": {
    category: "blended-aged",
    basis: "closest",
    note: "A pot + column blend aged 6-10 years, like the book's El Dorado 8 Year (❸ blended aged). Don Q Reserva 7 is column-still, closer to ❹ column still aged.",
  },
  "aged-jamaican-rum": {
    category: "blended-aged",
    basis: "closest",
    note: "An aged Jamaican blend at regular strength, like the book's Appleton Estate Reserve Blend (❸). The bottles we list aren't in the book, and Myers's (darkened) is closer to ❺ black blended.",
  },
  "overproof-aged-pot-rum": {
    category: "pot-still-lightly-aged",
    basis: "closest",
    note: "The book lists Smith & Cross as ❶ pot still lightly aged; Planteray O.F.T.D. and Hamilton 151, also in this style, are ❻ black blended overproof.",
  },
  "overproof-white-rum": {
    category: "pot-still-unaged",
    basis: "book",
    note: "The book lists Wray & Nephew overproof as pot still unaged (no number).",
  },
  "pot-still-rum": {
    category: "pot-still-aged",
    basis: "closest",
    note: "Aged pot-still rum; younger bottlings are closer to ❶ pot still lightly aged.",
  },
  "navy-rum": {
    category: "blended-aged",
    basis: "closest",
    note: "The book lists Pusser's as ❸ blended aged; The Black Tot is pot still long aged, and Wood's isn't listed.",
  },
  "dark-rum": {
    category: "black-blended",
    basis: "closest",
    note: "The book lists Goslings Black Seal and Coruba as ❺ black blended (Hamilton Jamaica Black is black pot still).",
  },
  "rhum-agricole-blanc": {
    category: "agricole-blanc",
    basis: "book",
    note: "❼ when it's AOC Martinique (Rhum J.M, Clément, Neisson…).",
  },
  "rhum-agricole-vieux": {
    category: "agricole-vieux",
    basis: "book",
    note: "❽ when it's AOC Martinique (Clément V.S.O.P., Rhum J.M V.S.O.P., Neisson Réserve Spéciale…).",
  },
  cachaca: {
    category: "cachaca-unaged",
    basis: "book",
    note: "The book lists Avuá Prata and Novo Fogo Silver as pot still unaged cachaça.",
  },
};

/**
 * Names that start like a listed bottle but are a different product the
 * book doesn't list (so they mustn't inherit its number).
 */
export const SC_NOT_LISTED: string[] = [
  "chairmans reserve white label",
  "chairmans reserve spiced",
  "denizen vatted dark",
  "la favorite coeur de canne",
  "goslings gold",
  "goslings family reserve",
];
