/**
 * Ingredient catalog: a tidy master list the recipes' ingredient wording
 * maps onto, so drinks can be browsed and (later) filtered by ingredient and
 * matched against a home bar.
 *
 * - `name` is a brand-neutral style ("Aged Jamaican rum (funky)"); `family`
 *   groups styles ("Rum").
 * - `brands` are example bottles to look for. For rum — where style names
 *   sound alike — they come from Difford's Guide's own product listing for
 *   the exact style its recipes call for (`brandsSource`). Elsewhere they're
 *   the bottle the recipe names plus widely available equivalents.
 * - `staple: true` = assumed always on hand (fresh citrus, water/soda/salt,
 *   Angostura), per John: these never block a drink from being "makeable".
 *
 * The recipe text itself (src cocktails.ingredients) is never changed; the
 * mapping below only links each verified wording to a catalog entry.
 */

export const FAMILIES = [
  "Rum",
  "Other cane spirits",
  "Gin & genever",
  "Whiskey",
  "Brandy",
  "Agave",
  "Vodka",
  "Liqueurs",
  "Amari, aperitivi & absinthe",
  "Wine, sherry & port",
  "Syrups",
  "Bitters",
  "Juices & purées",
  "Mixers",
  "Other",
] as const;

export type Family = (typeof FAMILIES)[number];

export interface Ingredient {
  id: string;
  name: string;
  family: Family;
  description?: string;
  brands: string[];
  brandsSource?: string;
  staple?: boolean;
}

const DG = "https://www.diffordsguide.com/beer-wine-spirits/category";

export const INGREDIENTS: Ingredient[] = [
  // ---------------------------------------------------------------- Rum
  {
    id: "light-white-rum",
    name: "Light white rum",
    family: "Rum",
    description:
      "Clean, light column-still molasses rum aged 1-4 years and charcoal-filtered clear. The classic Daiquiri rum — not overproof, not funky.",
    brands: ["Bacardi Carta Blanca", "Planteray 3 Stars", "Don Q Cristal", "Brugal Blanco Especial"],
    brandsSource: `${DG}/847/light-white-rum-charcoal-filtered-1-4-year-old-molasses-based`,
  },
  {
    id: "light-gold-rum",
    name: "Light gold rum",
    family: "Rum",
    description:
      "Light-bodied column-still molasses rum aged roughly 1-5 years and left golden. Smooth and gently oaky rather than rich.",
    brands: ["Bacardi Carta Oro", "Havana Club Añejo 3 Años", "Don Q Gold"],
    brandsSource: `${DG}/1370/light-gold-rum-1-3-year-old-molasses-column`,
  },
  {
    id: "aged-caribbean-rum",
    name: "Aged Caribbean rum (6-10 yr)",
    family: "Rum",
    description:
      "A blended (pot + column) molasses rum aged around 6-10 years: rounder, richer and oakier than gold rum, but not a funky Jamaican or a sweetened dark rum. Difford's own Mai Tai calls for Don Q Reserva 7 here.",
    brands: ["Don Q Reserva 7", "El Dorado 8 Year Old"],
  },
  {
    id: "aged-jamaican-rum",
    name: "Aged Jamaican rum (funky)",
    family: "Rum",
    description:
      "Aged Jamaican-style blend with the tell-tale 'funk' (ripe banana, pineapple, hogo) from pot-still rum, at normal strength (~40%).",
    brands: ["Crossfire Hurricane Gold", "Crossfire Hurricane Reserve", "Myers's Original Dark"],
    brandsSource: `${DG}/1543/jamaican-style-blended-and-aged-rums`,
  },
  {
    id: "overproof-aged-pot-rum",
    name: "Overproof aged pot-still rum (high-ester)",
    family: "Rum",
    description:
      "Big, pungent, high-strength (54-75%) rum aged a few years, typically Jamaican pot-still. Adds serious depth; don't substitute a white overproof. (Difford's also lists two rich Demerara-style blends here: Planteray O.F.T.D. and Hamilton 151.)",
    brands: ["Smith & Cross", "Hampden Estate HLCF Classic", "Worthy Park 109", "Planteray O.F.T.D.", "Hamilton 151"],
    brandsSource: `${DG}/1924/overproof-aged-rum-pot-still-jamaican-style`,
  },
  {
    id: "overproof-white-rum",
    name: "White overproof rum (Jamaican)",
    family: "Rum",
    description:
      "Unaged, very strong and very funky white rum, usually Jamaican at about 63%. (Denros, also listed by Difford's, is a far stronger St Vincent rum.)",
    brands: ["Wray & Nephew White Overproof", "Rum Fire Overproof (Hampden)", "Denros Strong Rum"],
    brandsSource: `${DG}/910/overproof-white-rum-unaged-jamaican/funky`,
  },
  {
    id: "overproof-light-rum",
    name: "Overproof aged light rum (low-ester)",
    family: "Rum",
    description:
      "High-strength but clean, light-bodied aged rum — strength without the funk. (Lemon Hart 151, also listed by Difford's, is richer and darker than the others.)",
    brands: ["Don Q 151", "Bounty Strong Rum", "Inner Circle Green Dot", "Lemon Hart 151"],
    brandsSource: `${DG}/1925/overproof-aged-light-bodied-rum-low-ester-2-5-years-old`,
  },
  {
    id: "pot-still-rum",
    name: "Pot-still rum (40-50%)",
    family: "Rum",
    description: "Rum made only in pot stills, at regular-to-high strength: full-bodied and characterful.",
    brands: ["Hampden Estate 8 Year Old", "Worthy Park Select", "Planteray Xaymaca"],
    brandsSource: `${DG}/934/100-pot-still-rums`,
  },
  {
    id: "navy-rum",
    name: "Navy rum",
    family: "Rum",
    description:
      "Rich, dark, pot-still-heavy blend in the old Royal Navy style, ideally at 'navy strength' 54.5-57%.",
    brands: ["Pusser's Gunpowder Proof (54.5%)", "Wood's 100 Old Navy Rum (57%)", "Black Tot (46.2%, below navy strength)"],
  },
  {
    id: "dark-rum",
    name: "Dark / black rum",
    family: "Rum",
    description: "Molasses rum darkened with caramel or molasses: sweet, heavy and dark. Blackstrap styles are the most intense.",
    brands: ["Goslings Black Seal", "Planteray Original Dark", "Hamilton Jamaica Black", "Coruba"],
  },
  {
    id: "rhum-agricole-blanc",
    name: "Rhum agricole blanc (unaged)",
    family: "Rum",
    description: "Unaged rum distilled from fresh sugar-cane juice (usually Martinique): grassy and vegetal.",
    brands: ["Rhum J.M Blanc", "Rhum Clément Blanc", "Dillon Blanc"],
  },
  {
    id: "rhum-agricole-vieux",
    name: "Rhum agricole vieux (aged)",
    family: "Rum",
    description: "Cane-juice rhum aged at least 3 years: grassy notes plus oak and dried fruit.",
    brands: ["Rhum Clément VSOP", "Rhum J.M VSOP", "Neisson Réserve Spéciale"],
  },
  {
    id: "pineapple-rum",
    name: "Pineapple rum",
    family: "Rum",
    description: "Rum infused with pineapple (flesh and rind).",
    brands: ["Planteray Stiggins' Fancy Pineapple"],
  },
  {
    id: "coconut-rum",
    name: "Coconut rum liqueur (35-40%)",
    family: "Rum",
    description: "Coconut-flavoured rum at near full strength. Malibu (21%) is weaker and sweeter, so it isn't a like-for-like swap.",
    brands: ["Koko Kanu", "Bacardi Coconut (35%)"],
  },
  {
    id: "malibu",
    name: "Malibu (light coconut rum liqueur, 21%)",
    family: "Rum",
    brands: ["Malibu Original"],
  },
  {
    id: "spiced-rum-cacao-coffee",
    name: "Cacao & coffee spiced rum",
    family: "Rum",
    description: "Spiced rum flavoured with cacao and coffee.",
    brands: ["Black Tears Cacao & Coffee Spiced Rum"],
  },

  // ---------------------------------------------------- Other cane spirits
  {
    id: "cachaca",
    name: "Cachaça (unaged)",
    family: "Other cane spirits",
    brands: ["Avuá Prata", "Novo Fogo Silver"],
  },

  // ----------------------------------------------------------- Gin
  { id: "london-dry-gin", name: "London dry gin", family: "Gin & genever", brands: ["Hayman's London Dry", "Beefeater", "Tanqueray"] },
  { id: "oude-genever", name: "Oude genever", family: "Gin & genever", brands: ["Bols Oude Genever", "Rutte Oude Genever"] },

  // ------------------------------------------------------- Whiskey
  { id: "bourbon", name: "Bourbon whiskey", family: "Whiskey", brands: ["Buffalo Trace", "Wild Turkey 101", "Maker's Mark"] },
  {
    id: "rye-whiskey-100",
    name: "Straight rye whiskey (100 proof)",
    family: "Whiskey",
    brands: ["Rittenhouse Rye Bottled-in-Bond", "Old Overholt Bonded"],
  },
  { id: "blended-malt-scotch", name: "Blended malt Scotch whisky", family: "Whiskey", brands: ["Monkey Shoulder", "Johnnie Walker Green Label"] },
  {
    id: "new-make-spirit",
    name: "New make spirit (unaged whisky)",
    family: "Whiskey",
    description: "Clear, unaged malt spirit straight off the still ('white dog').",
    brands: [],
  },

  // -------------------------------------------------------- Brandy
  { id: "cognac", name: "Cognac", family: "Brandy", brands: ["Pierre Ferrand 1840", "Rémy Martin VSOP"] },
  {
    id: "apple-brandy",
    name: "Calvados / apple brandy",
    family: "Brandy",
    brands: ["Laird's Straight Apple Brandy (Bonded)", "Christian Drouin Calvados"],
  },
  { id: "pisco", name: "Pisco", family: "Brandy", brands: ["BarSol Mosto Verde Italia", "Macchu Pisco"] },

  // --------------------------------------------------------- Agave
  { id: "blanco-tequila", name: "Blanco tequila", family: "Agave", brands: ["Olmeca Altos Plata", "Espolòn Blanco"] },
  { id: "reposado-tequila", name: "Reposado tequila", family: "Agave", brands: ["Patrón Reposado", "Espolòn Reposado"] },
  { id: "mezcal", name: "Mezcal", family: "Agave", brands: ["Del Maguey Vida"] },
  { id: "crema-de-mezcal", name: "Crema de mezcal", family: "Agave", brands: ["Del Maguey Crema de Mezcal"] },

  // --------------------------------------------------------- Vodka
  { id: "vodka", name: "Vodka", family: "Vodka", brands: ["Ketel One"] },
  { id: "vanilla-vodka", name: "Vanilla vodka", family: "Vodka", brands: ["Absolut Vanilia"] },

  // ------------------------------------------------------ Liqueurs
  {
    id: "orgeat-almond-liqueur",
    name: "Almond (orgeat) liqueur",
    family: "Liqueurs",
    description: "An alcoholic almond liqueur (about 20%) — not the same as orgeat syrup.",
    brands: ["L'Orgeat Almond Liqueur"],
    brandsSource: `${DG}/1816/orgeat-almond-liqueurs`,
  },
  { id: "amaretto", name: "Amaretto", family: "Liqueurs", brands: ["Adriatico Amaretto", "Disaronno"] },
  {
    id: "dry-curacao",
    name: "Dry orange curaçao",
    family: "Liqueurs",
    brands: ["Ferrand Dry Curaçao"],
  },
  {
    id: "tropical-dry-curacao",
    name: "Tropical (rum-based) dry curaçao",
    family: "Liqueurs",
    description: "A dry orange curaçao built on rum rather than brandy.",
    brands: ["Ferrand Dry Curaçao Tropical"],
  },
  { id: "triple-sec", name: "Triple sec", family: "Liqueurs", brands: ["Cointreau"] },
  { id: "cognac-orange-liqueur", name: "Cognac orange liqueur", family: "Liqueurs", brands: ["Grand Marnier"] },
  { id: "blue-curacao", name: "Blue curaçao", family: "Liqueurs", brands: ["Bols Blue Curaçao", "Giffard Blue Curaçao"] },
  {
    id: "falernum",
    name: "Falernum liqueur",
    family: "Liqueurs",
    description: "Barbadian lime, clove, ginger and almond liqueur.",
    brands: ["John D. Taylor's Velvet Falernum", "Difford's Falernum"],
    brandsSource: `${DG}/220/falernum`,
  },
  {
    id: "allspice-dram",
    name: "Allspice (pimento) dram",
    family: "Liqueurs",
    brands: ["St. Elizabeth Allspice Dram", "Hamilton Pimento Dram"],
  },
  { id: "banana-liqueur", name: "Banana liqueur (crème de banane)", family: "Liqueurs", brands: ["Giffard Banane du Brésil", "Tempus Fugit Crème de Banane"] },
  { id: "pineapple-liqueur", name: "Pineapple liqueur", family: "Liqueurs", brands: ["Giffard Caribbean Pineapple"] },
  { id: "apricot-liqueur", name: "Apricot liqueur", family: "Liqueurs", brands: ["Luxardo Apricot", "Rothman & Winter Orchard Apricot"] },
  { id: "maraschino-liqueur", name: "Maraschino liqueur", family: "Liqueurs", brands: ["Luxardo Maraschino", "Maraska Maraschino"] },
  { id: "cherry-liqueur", name: "Cherry (brandy) liqueur", family: "Liqueurs", brands: ["Cherry Heering"] },
  { id: "blackberry-liqueur", name: "Blackberry liqueur (crème de mûre)", family: "Liqueurs", brands: ["Giffard Crème de Mûre"] },
  { id: "peach-liqueur", name: "Peach liqueur (crème de pêche)", family: "Liqueurs", brands: ["Giffard Crème de Pêche de Vigne"] },
  { id: "peach-schnapps", name: "Peach schnapps", family: "Liqueurs", brands: ["DeKuyper Peachtree"] },
  { id: "white-creme-de-menthe", name: "White crème de menthe", family: "Liqueurs", brands: ["Giffard Menthe Pastille"] },
  { id: "white-creme-de-cacao", name: "White crème de cacao", family: "Liqueurs", brands: ["Giffard White Crème de Cacao", "Tempus Fugit Crème de Cacao"] },
  { id: "parfait-amour", name: "Parfait amour", family: "Liqueurs", brands: ["Giffard Parfait Amour", "Marie Brizard Parfait Amour"] },
  {
    id: "chocolate-orange-liqueur",
    name: "Chocolate orange liqueur",
    family: "Liqueurs",
    brands: ["Sabra Chocolate Orange"],
    brandsSource: `${DG}/1784/chocolate-orange-liqueur`,
  },
  {
    id: "coffee-liqueur",
    name: "Coffee liqueur",
    family: "Liqueurs",
    description: "The recipe names Galliano Espresso, which is stronger and drier than Kahlúa; Kahlúa works but is sweeter.",
    brands: ["Galliano Espresso", "Kahlúa"],
  },
  { id: "galliano", name: "Galliano L'Autentico", family: "Liqueurs", brands: ["Galliano L'Autentico"] },
  { id: "licor-43", name: "Licor 43", family: "Liqueurs", brands: ["Licor 43 Original"] },
  { id: "benedictine", name: "Bénédictine", family: "Liqueurs", brands: ["Bénédictine D.O.M."] },
  { id: "green-chartreuse", name: "Green Chartreuse", family: "Liqueurs", brands: ["Green Chartreuse"] },
  { id: "yellow-chartreuse", name: "Yellow Chartreuse", family: "Liqueurs", brands: ["Yellow Chartreuse"] },
  { id: "passion-fruit-liqueur", name: "Passion fruit liqueur", family: "Liqueurs", brands: ["Passoã"] },

  // ------------------------------------ Amari, aperitivi & absinthe
  { id: "italian-red-bitter", name: "Italian red bitter", family: "Amari, aperitivi & absinthe", brands: ["Campari"] },
  {
    id: "red-aperitivo",
    name: "Red aperitivo (lighter, orange-bitter)",
    family: "Amari, aperitivi & absinthe",
    brands: ["Aperol", "Santoni L'Aperitivo"],
  },
  {
    id: "amaro",
    name: "Amaro (medium-bodied)",
    family: "Amari, aperitivi & absinthe",
    description: "Bittersweet Italian herbal liqueur. Amari vary a lot; the recipe suggests Meletti.",
    brands: ["Amaro Meletti", "Averna"],
  },
  {
    id: "amaro-montenegro",
    name: "Amaro Montenegro",
    family: "Amari, aperitivi & absinthe",
    description: "A light, floral, orange-peel amaro (23%) — much lighter than most amari.",
    brands: ["Amaro Montenegro"],
  },
  { id: "cynar", name: "Cynar (artichoke amaro)", family: "Amari, aperitivi & absinthe", brands: ["Cynar"] },
  { id: "fernet", name: "Fernet", family: "Amari, aperitivi & absinthe", brands: ["Fernet-Branca"] },
  { id: "absinthe", name: "Absinthe (green)", family: "Amari, aperitivi & absinthe", brands: ["La Fée Parisienne", "Pernod Absinthe"] },
  { id: "absinthe-blanche", name: "Absinthe blanche (clear)", family: "Amari, aperitivi & absinthe", brands: ["La Fée Blanche", "Kübler"] },

  // ------------------------------------------ Wine, sherry & port
  { id: "sweet-vermouth", name: "Sweet (rosso) vermouth", family: "Wine, sherry & port", brands: ["Strucchi Rosso", "Carpano Antica Formula"] },
  { id: "fino-sherry", name: "Fino sherry", family: "Wine, sherry & port", brands: ["Lustau Jarana Fino", "Tio Pepe"] },
  { id: "amontillado-sherry", name: "Amontillado sherry", family: "Wine, sherry & port", brands: ["Lustau Los Arcos Amontillado"] },
  { id: "oloroso-sherry", name: "Oloroso sherry", family: "Wine, sherry & port", brands: ["Lustau Don Nuño Oloroso"] },
  { id: "ruby-port", name: "Ruby port", family: "Wine, sherry & port", brands: ["Cockburn's Ruby Soho"] },
  { id: "champagne", name: "Brut champagne / sparkling wine", family: "Wine, sherry & port", brands: [] },
  { id: "prosecco", name: "Extra dry prosecco", family: "Wine, sherry & port", brands: ["Fiol Extra Dry Prosecco"] },

  // --------------------------------------------------------- Syrups
  { id: "orgeat-syrup", name: "Orgeat (almond) syrup", family: "Syrups", brands: ["Monin Almond (Orgeat)", "Small Hand Foods Orgeat", "Liber & Co. Orgeat"] },
  { id: "rich-sugar-syrup", name: "Rich sugar syrup (2:1)", family: "Syrups", description: "Two parts sugar to one part water — easy to make.", brands: [] },
  { id: "demerara-syrup", name: "Demerara / brown sugar syrup (2:1)", family: "Syrups", brands: [] },
  { id: "honey-syrup", name: "Honey syrup", family: "Syrups", description: "Honey loosened with a little water so it mixes (one recipe specifies 3 parts honey to 1 water).", brands: [] },
  { id: "agave-syrup", name: "Agave syrup", family: "Syrups", brands: [] },
  { id: "maple-syrup", name: "Maple syrup", family: "Syrups", brands: [] },
  { id: "cane-syrup", name: "Sugar cane syrup", family: "Syrups", brands: ["Petite Canne"] },
  { id: "cinnamon-syrup", name: "Cinnamon syrup", family: "Syrups", brands: ["Monin Cinnamon", "B.G. Reynolds Cinnamon"] },
  { id: "grenadine", name: "Grenadine", family: "Syrups", brands: ["Monin Grenadine", "Liber & Co. Grenadine"] },
  { id: "passion-fruit-syrup", name: "Passion fruit syrup", family: "Syrups", brands: ["Monin Passion Fruit", "B.G. Reynolds Passion Fruit"] },
  { id: "pineapple-syrup", name: "Pineapple syrup", family: "Syrups", brands: ["Monin Pineapple"] },
  { id: "strawberry-syrup", name: "Strawberry syrup", family: "Syrups", brands: ["Monin Strawberry"] },
  { id: "vanilla-syrup", name: "Vanilla syrup", family: "Syrups", brands: ["Monin Vanilla"] },
  { id: "ginger-syrup", name: "Ginger syrup", family: "Syrups", description: "Equal weights ginger juice and sugar.", brands: [] },
  { id: "lime-cordial", name: "Lime cordial", family: "Syrups", brands: ["Rose's Lime Juice Cordial"] },
  { id: "maraschino-cherry-syrup", name: "Maraschino cherry syrup (from the jar)", family: "Syrups", brands: ["Luxardo Maraschino Cherries"] },

  // --------------------------------------------------------- Bitters
  { id: "angostura-bitters", name: "Angostura aromatic bitters", family: "Bitters", brands: ["Angostura Aromatic"], staple: true },
  { id: "orange-bitters", name: "Orange bitters", family: "Bitters", brands: ["Angostura Orange"] },
  { id: "creole-bitters", name: "Peychaud's / Creole bitters", family: "Bitters", brands: ["Peychaud's"] },
  { id: "pimento-bitters", name: "Pimento (allspice) bitters", family: "Bitters", brands: ["Dale DeGroff's Pimento Aromatic Bitters"] },
  { id: "chocolate-bitters", name: "Chocolate bitters", family: "Bitters", brands: ["Fee Brothers Aztec Chocolate", "Scrappy's Chocolate"] },
  { id: "mole-bitters", name: "Mole bitters", family: "Bitters", brands: ["Bittermens Xocolatl Mole"] },
  { id: "old-fashioned-bitters", name: "Old-fashioned bitters", family: "Bitters", brands: ["Fee Brothers Old Fashion Aromatic"] },
  { id: "daiquiri-bitters", name: "Difford's Daiquiri Bitters", family: "Bitters", brands: ["Difford's Daiquiri Bitters"] },
  { id: "margarita-bitters", name: "Difford's Margarita Bitters", family: "Bitters", brands: ["Difford's Margarita Bitters"] },

  // ------------------------------------------------- Juices & purées
  { id: "lime", name: "Lime / lime juice (fresh)", family: "Juices & purées", brands: [], staple: true },
  { id: "lemon-juice", name: "Lemon juice (fresh)", family: "Juices & purées", brands: [], staple: true },
  { id: "orange-juice", name: "Orange juice (fresh)", family: "Juices & purées", brands: [], staple: true },
  { id: "grapefruit-juice", name: "Pink grapefruit juice (fresh)", family: "Juices & purées", brands: [], staple: true },
  { id: "pineapple-juice", name: "Pineapple juice", family: "Juices & purées", brands: [] },
  { id: "coconut-water", name: "Coconut water", family: "Juices & purées", brands: [] },
  { id: "passion-fruit-puree", name: "Passion fruit purée", family: "Juices & purées", brands: ["Boiron", "Perfect Purée"] },
  { id: "white-peach-puree", name: "White peach purée", family: "Juices & purées", brands: ["Boiron"] },

  // --------------------------------------------------------- Mixers
  { id: "ginger-ale", name: "Ginger ale", family: "Mixers", brands: ["Thomas Henry", "Fever-Tree"] },
  { id: "ginger-beer", name: "Ginger beer", family: "Mixers", brands: ["Thomas Henry", "Fever-Tree", "Goslings"] },
  { id: "cola", name: "Cola", family: "Mixers", brands: [] },
  { id: "soda-water", name: "Soda water", family: "Mixers", brands: [], staple: true },
  { id: "water", name: "Water", family: "Mixers", brands: [], staple: true },
  { id: "saline", name: "Saline solution / salt", family: "Mixers", description: "20g sea salt dissolved in 80g water, or a tiny pinch of salt.", brands: [], staple: true },

  // ---------------------------------------------------------- Other
  { id: "cream-of-coconut", name: "Cream of coconut", family: "Other", description: "Sweetened coconut cream (not coconut milk).", brands: ["Coco López", "Re'al"] },
  { id: "egg-white", name: "Egg white (or foamer)", family: "Other", brands: ["Fee Brothers Fee Foam (vegan alternative)"] },
  { id: "milk", name: "Whole milk", family: "Other", brands: [] },
  { id: "xanthan-gum", name: "Xanthan gum", family: "Other", brands: [] },
  { id: "mint", name: "Fresh mint", family: "Other", brands: [] },
  { id: "basil", name: "Fresh basil", family: "Other", brands: [] },
  { id: "strawberries", name: "Fresh strawberries", family: "Other", brands: [] },
  { id: "fresh-pineapple", name: "Fresh pineapple", family: "Other", brands: [] },
];

/**
 * Every ingredient wording used in the 100 verified recipes, mapped to its
 * catalog id. A unit test checks this covers every recipe line exactly.
 * "(optional)" is detected from the wording itself (see resolveIngredient).
 */
export const INGREDIENT_ALIASES: Record<string, string> = {
  // Rum
  "Light white rum": "light-white-rum",
  "Light white rum (charcoal-filtered 1-4 years old)": "light-white-rum",
  "Light gold rum (1-3 year old molasses column)": "light-gold-rum",
  "Caribbean light rum aged 3-5 years": "light-gold-rum",
  "Caribbean blended rum aged 6-10 years": "aged-caribbean-rum",
  "Jamaican-style aged blended rum with funk": "aged-jamaican-rum",
  "Crossfire Hurricane Jamaican Rum": "aged-jamaican-rum",
  "Overproof aged pot still rum (high-ester 4-6 years old)": "overproof-aged-pot-rum",
  "Overproof white rum (unaged Jamaican/funky)": "overproof-white-rum",
  "Overproof aged light-bodied rum (low-ester, 2-5 years old)": "overproof-light-rum",
  "100% pot still rum (40-50% alc./vol.)": "pot-still-rum",
  "Navy rum (ideally 54.5% alc./vol.)": "navy-rum",
  "Navy rum (ideally 54.5% alc./vol.) (float)": "navy-rum",
  "Navy rum (ideally circa 55% alc./vol.)": "navy-rum",
  "Dark/black/blackstrap rum": "dark-rum",
  "Dark/black/blackstrap rum (optional)": "dark-rum",
  "Agricole blanc/cane juice rhum (unaged)": "rhum-agricole-blanc",
  "Agricole vieux rhum/Cane juice rum (min 3yo)": "rhum-agricole-vieux",
  "Pineapple rum": "pineapple-rum",
  "Coconut rum liqueur (35-40% alc./vol.)": "coconut-rum",
  "Malibu Original coconut rum liqueur": "malibu",
  "Cacao & coffee spiced rum": "spiced-rum-cacao-coffee",
  // Other cane
  "Cachaça (unaged)": "cachaca",
  // Gin
  "Hayman's London Dry Gin": "london-dry-gin",
  "Oude genever": "oude-genever",
  // Whiskey
  "Bourbon whiskey": "bourbon",
  "Straight rye whiskey (100 proof /50% alc./vol.)": "rye-whiskey-100",
  "Straight rye whiskey (100 proof/50% alc./vol.)": "rye-whiskey-100",
  "Blended/vatted Scotch malt whisky": "blended-malt-scotch",
  "New make spirit": "new-make-spirit",
  // Brandy
  "Cognac (brandy)": "cognac",
  "Calvados / apple brandy / straight applejack": "apple-brandy",
  "Calvados/apple brandy/straight applejack": "apple-brandy",
  "Pisco": "pisco",
  "BarSol Mosto Verde Italia Pisco": "pisco",
  // Agave
  "Blanco tequila": "blanco-tequila",
  "Reposado tequila (100% agave)": "reposado-tequila",
  "Patrón Reposado tequila": "reposado-tequila",
  "Del Maguey Vida Clásico Mezcal": "mezcal",
  "Del Maguey Crema de Mezcal": "crema-de-mezcal",
  // Vodka
  "Ketel One Vodka": "vodka",
  "Vanilla flavoured vodka": "vanilla-vodka",
  // Liqueurs
  "Orgeat almond liqueur": "orgeat-almond-liqueur",
  "Adriatico Amaretto Liqueur": "amaretto",
  "Ferrand Dry Curaçao liqueur": "dry-curacao",
  "Ferrand Tropical Dry Curaçao": "tropical-dry-curacao",
  "Cointreau L'Unique triple sec liqueur": "triple-sec",
  "Grand Marnier or other cognac orange liqueur": "cognac-orange-liqueur",
  "Bols Blue Curaçao": "blue-curacao",
  "Falernum liqueur": "falernum",
  "Difford's Falernum liqueur": "falernum",
  "St. Elizabeth Allspice Dram liqueur": "allspice-dram",
  "Giffard Banane du Brésil liqueur": "banana-liqueur",
  "Giffard Caribbean Pineapple liqueur": "pineapple-liqueur",
  "Luxardo Apricot Albicocca Liqueur": "apricot-liqueur",
  "Luxardo Maraschino liqueur": "maraschino-liqueur",
  "Cherry (brandy) liqueur": "cherry-liqueur",
  "Giffard Crème de Mûre liqueur": "blackberry-liqueur",
  "Giffard Crème de Pêche de Vigne liqueur": "peach-liqueur",
  "Peach schnapps liqueur": "peach-schnapps",
  "Giffard Menthe Pastille white crème de menthe": "white-creme-de-menthe",
  "Giffard White Crème de Cacao Liqueur": "white-creme-de-cacao",
  "Giffard Parfait Amour liqueur": "parfait-amour",
  "Chocolate orange liqueur": "chocolate-orange-liqueur",
  "Galliano Espresso Coffee liqueur": "coffee-liqueur",
  "Galliano L'Autentico liqueur": "galliano",
  "Licor 43 Original liqueur": "licor-43",
  "Bénédictine D.O.M. liqueur": "benedictine",
  "Green Chartreuse (or alternative herbal liqueur)": "green-chartreuse",
  "Yellow Chartreuse (or génépy liqueur)": "yellow-chartreuse",
  "Passoã passion fruit liqueur": "passion-fruit-liqueur",
  // Amari etc.
  "Italian red bitter liqueur": "italian-red-bitter",
  "Bittersweet orange-red aperitivo": "red-aperitivo",
  "Santoni L'Aperitivo": "red-aperitivo",
  "Amaro (e.g. Meletti)": "amaro",
  "Amaro Montenegro": "amaro-montenegro",
  "Cynar or other carciofo amaro": "cynar",
  "Fernet Branca liqueur": "fernet",
  "La Fée Parisienne absinthe": "absinthe",
  "La Fée Absinthe Blanche": "absinthe-blanche",
  // Wine
  "Strucchi Rosso Vermouth": "sweet-vermouth",
  "Lustau Jarana Fino Sherry": "fino-sherry",
  "Lustau Amontillado Los Arcos Sherry": "amontillado-sherry",
  "Oloroso Sherry": "oloroso-sherry",
  "Cockburn's Ruby Soho Port": "ruby-port",
  "Brut champagne/sparkling wine": "champagne",
  "Fiol Extra Dry Prosecco": "prosecco",
  // Syrups
  "Monin Almond (Orgeat) Syrup": "orgeat-syrup",
  "Orgeat syrup": "orgeat-syrup",
  "Sugar syrup 'rich' (2 sugar to 1 water)": "rich-sugar-syrup",
  "Sugar syrup 'rich' (2 sugar to 1 water) 65.0°Brix": "rich-sugar-syrup",
  "Sugar syrup 'rich' (2 sugar to 1 water, 65.0°Brix)": "rich-sugar-syrup",
  "Demerara/Muscovado/brown sugar syrup (2 sugar to 1 water)": "demerara-syrup",
  "Honey syrup (3 parts honey to 1 water by weight)": "honey-syrup",
  "Honey sugar syrup": "honey-syrup",
  "Agave syrup (agave nectar)": "agave-syrup",
  "Maple syrup": "maple-syrup",
  "Sugar cane syrup (from juice)": "cane-syrup",
  "Monin Cinnamon Syrup": "cinnamon-syrup",
  "Monin Grenadine Syrup": "grenadine",
  "Monin Passion Fruit Syrup": "passion-fruit-syrup",
  "Monin Pineapple Syrup": "pineapple-syrup",
  "Monin Strawberry Syrup": "strawberry-syrup",
  "Monin Vanilla Syrup": "vanilla-syrup",
  "Ginger syrup (equal parts ginger juice to caster sugar by weight)": "ginger-syrup",
  "Lime cordial (sweetened lime juice)": "lime-cordial",
  "Maraschino (Marasca) syrup (from cherry jar)": "maraschino-cherry-syrup",
  // Bitters
  "Angostura Aromatic Bitters": "angostura-bitters",
  "Orange Bitters by Angostura": "orange-bitters",
  "Peychaud's or other Creole-style bitters": "creole-bitters",
  "Pimento bitters": "pimento-bitters",
  "Chocolate bitters": "chocolate-bitters",
  "Mole bitters": "mole-bitters",
  "Old-fashioned / old time bitters": "old-fashioned-bitters",
  "Difford's Daiquiri Bitters": "daiquiri-bitters",
  "Difford's Daiquiri Bitters (optional)": "daiquiri-bitters",
  "Difford's Margarita Bitters": "margarita-bitters",
  // Juices
  "Lime juice (freshly squeezed)": "lime",
  "Lime (fresh)": "lime",
  "Lemon juice (freshly squeezed)": "lemon-juice",
  "Orange juice (freshly squeezed)": "orange-juice",
  "Pink grapefruit juice (freshly squeezed)": "grapefruit-juice",
  "Pineapple juice": "pineapple-juice",
  "Pineapple juice (brine)": "pineapple-juice",
  "Pineapple juice (chilled)": "pineapple-juice",
  "Pineapple juice, chilled": "pineapple-juice",
  "Coconut water": "coconut-water",
  "Passion fruit purée": "passion-fruit-puree",
  "White peach purée": "white-peach-puree",
  // Mixers
  "Thomas Henry Ginger Ale": "ginger-ale",
  "Thomas Henry Ginger Beer": "ginger-beer",
  "Cola": "cola",
  "Thomas Henry Soda Water, chilled": "soda-water",
  "Chilled water/mineral water (omit if using wet ice)": "water",
  "Saline solution": "saline",
  "Saline solution (optional)": "saline",
  "Saline solution (20g sea salt to 80g water)": "saline",
  "Saline solution (20g sea salt to 80g water) or merest pinch of salt": "saline",
  "Saline solution (20g sea salt to 80g water) or merest pinch of salt (optional)": "saline",
  // Other
  "Cream of coconut": "cream-of-coconut",
  "Cream of coconut (e.g. Coco Lopez, Re'al etc.)": "cream-of-coconut",
  "Egg white (pasteurised)": "egg-white",
  "Egg white (pasteurised) or 3 dash Fee Brothers Fee Foam cocktail foamer": "egg-white",
  "Egg white (pasteurised) or Fee Brothers Fee Foam cocktail foamer": "egg-white",
  "Milk (whole milk/full 3-4% fat)": "milk",
  "Xanthan gum (E415)": "xanthan-gum",
  "Xanthan gum (E415) (optional)": "xanthan-gum",
  "Fresh mint": "mint",
  "Fresh mint leaves": "mint",
  "fresh Mint leaves": "mint",
  "Fresh basil": "basil",
  "fresh Strawberries (hulled, small & ripe)": "strawberries",
  "Pineapple (fresh)": "fresh-pineapple",
};
