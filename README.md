# Equal Parts

John (JB) and Genny (GM)'s home bar app: a mobile-first tasting log, bar
inventory, shopping list and recipe book, organised into **collections**
(Tiki, Classics, Prohibition, and any we add). It started as "Adventures in
Tiki", a tracker for Difford's Guide's Top 100 Tiki & Tropical Cocktails;
that's now the Tiki collection, which keeps its name and tropical look.

**Live:** https://tiki-adventure-app-beige.vercel.app

Recipe data (ingredients, amounts, glassware, garnish) is independently
verified against each cocktail's actual recipe page on
[diffordsguide.com](https://www.diffordsguide.com/cocktails/directory/styles/tiki-tropical) —
see `seed-data/cocktails.json`. The Classics are the International
Bartenders Association's [official cocktails](https://iba-world.com/cocktails/all-cocktails/),
checked the same way against each drink's IBA page -- see
`seed-data/iba-cocktails.json`. Method descriptions are written in our own
words rather than copied from the source, and every recipe card credits and
links back to the original.

## Stack

- [Next.js](https://nextjs.org/) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com/) for mobile-first styling
- [Supabase](https://supabase.com/) (Postgres + Auth) for the database
- [Vitest](https://vitest.dev/) for unit tests
- [Playwright](https://playwright.dev/) for end-to-end tests
- Deployed on [Vercel](https://vercel.com/) (Hobby plan)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project URL + anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app reads the cocktail list and tastings live from Supabase
(`src/lib/supabase.ts`, `src/lib/cocktails.ts`) using the publishable/anon
key, which only has public SELECT access. Saving a rating requires signing
in; see below.

## What's in the app

- **Collections** -- a row of collection pills on the home page (`?c=tiki`,
  `?c=classics`, `?c=prohibition`, or All drinks) scopes the list, search,
  filters, "Try next" and the progress tiles. Tiki shows the original
  "Adventures in Tiki" header; everything else the calmer Equal Parts look.
  Starting collections (migrations 0011/0012, from `seed-data/collections.json`):
  - **Tiki** -- Difford's Top 100 Tiki & Tropical, our own recipes at the
    time, plus IBA Tiki, Piña Colada and Planters Punch.
  - **Classics** -- all 102 IBA official cocktails: 96 new rows
    (`source = 'iba'`, read-only, ingredients as IBA publishes them in ml)
    plus the six already in Difford's list (Mai Tai (Trader Vic's), Zombie,
    Jungle Bird, Missionary's Downfall, Three Dots and a Dash, Suffering
    Bastard), which keep Difford's recipe with a note that IBA's differs.
  - **Prohibition** -- 18 drinks created or first recorded during US
    Prohibition (1920–1933), plus the Daiquiri (popularised then), each
    with a dated story and a source link on its card. Bloody Mary and Mimosa
    are left out: neither is documented until after repeal.
  A recipe card lists its collections (tasters can change them there);
  `/collections` lets tasters add, rename and remove collections (the three
  starting ones can be renamed, not removed); the recipe form has
  collection checkboxes (pre-ticked when "Add a recipe" is used from a
  collection). Stats show progress per collection. Logic in
  `src/lib/collections.ts`.
- **Home (`/`)** -- progress tiles and every drink, filterable by
  All / Tasted / Not yet and by ingredient (pick one or more; drinks using
  all of them, or any of them). Every filter state is a shareable URL, e.g.
  `/?show=untasted&ing=aged-jamaican-rum,falernum&match=any`. A search box
  (`?q=`) matches names, spirits and ingredients: every word must start a
  word somewhere, ignoring case, accents and punctuation ("pina", "jamaican
  falernum", "trader vics"). "Try next" shows three suggestions. Tap a drink
  for its recipe card.
- **What to try next (`/next`)** -- ten drinks we haven't tried, ranked by
  how much they share ingredients with drinks we rated above our average
  (and below it, downwards), plus a boost for what our bar can make when
  signed in; each says why ("Like Zombie (our 8.9): both use …"). Pure
  logic in `src/lib/suggest.ts`.
- **Recipe card (`/cocktails/[slug]`)** -- ingredients (make 1×–8×, and
  show amounts as written, in fl oz or in ml: `?serves=2&units=ml`; the unit
  choice is remembered; converted at 1 fl oz = 30 ml, Difford's own basis,
  so ml shows Difford's original amounts exactly; dashes/drops round to
  whole numbers; barspoons of powder are never converted -- see
  `src/lib/amounts.ts`), glass, garnish,
  method, "Our tasting" (ratings, dates, notes), and a credit link to the
  original on Difford's Guide.
- **Stats (`/stats`)** -- progress by Difford's rank band, John vs Genny,
  rating spread, where we disagree, favorites.
- **Ingredients (`/ingredients`)** -- every ingredient in our recipes as a
  brand-neutral style, grouped by family, with example bottles to look for
  and the drinks that use it. Recipe-card ingredient lines link here. The
  catalog lives in `src/data/ingredients.ts`: each style has a family,
  example brands (for rum, taken from Difford's Guide's product listing for
  the exact style, linked on the page), and "staple" flags for what's
  assumed always on hand (fresh citrus, water/soda/salt, Angostura).
  `INGREDIENT_ALIASES` maps each recipe's exact wording to a style without
  changing the verified recipe text; unit tests fail if any recipe line is
  unmapped. Each example bottle links to a Total Wine search (their site
  shows stock at your chosen store), and the page offers a tap-to-call link
  for WineXpress (Five Forks), which has no online catalog
  (`src/lib/stores.ts`).
- **Our bar (`/cabinet`)** -- JB & GM's shared home bar (signed-in tasters
  only). Tick what's on the shelf at `/cabinet/edit` (optionally the exact
  bottle); the page lists what we can make right now, and "Buy next" --
  single ingredients that would each complete more drinks. Recipe cards
  say "We can make this" or what's missing, and ingredient pages show an
  "In our bar" chip. Staples and lines marked "(optional)" never count as
  missing. Saves only the rows you changed, so two people editing at once
  don't undo each other (`planCabinetSave` in `src/lib/cabinet.ts`). Stored
  in `cabinet_items` (migration 0006; RLS: tasters only, `updated_by` must
  be you).
- **Living bar inventory** -- on `/cabinet/levels` set each bottle's size
  and roughly how full it is. "We made this" on a recipe card (for the
  chosen servings) records the pour and counts tracked bottles down;
  "Undo" puts back exactly what was taken. Only liquid volume lines count
  (not dashes/drops, barspoons, optional lines or staples). Bottles below
  about a fifth (at least ~60 ml) show as **running low** on our bar and the
  home page, can go on the shopping list as a restock, and "Got it" refills
  them. The bookkeeping is in the database (`record_pour`/`undo_pour`,
  migration 0009): validated, locked in a fixed order, and idempotent per
  submit so a double tap counts once.
- **Bar scanner (`/cabinet/scan`)** -- snap **a bottle**: an AI model
  (the same OpenRouter setup as the recipe helper) reads the product, its
  style from our catalog, the size on the label and estimates how full it
  is; or snap **a receipt** (grocery store, WineXpress, a liquor store) to
  list what was bought. Either way you check a form first (it says what a
  save would replace in our bar, flags odd sizes, and adds receipt bottles
  as full); then it goes into our bar with sizes and levels.
- **Shopping list (`/shopping`)** -- one shared list (signed-in tasters
  only). Add from a recipe card ("Add all 3 to shopping list"), an
  ingredient page, "Buy next" in our bar, or the ideas on the list itself.
  Each item shows what it would complete together with the rest of the
  list, bottles to look for with Total Wine search links, and WineXpress's
  number. "Got it" moves it into our bar (keeping any bottle already noted);
  ticking it in our bar also takes it off the list. Stored in
  `shopping_items` (migration 0007; RLS: tasters only, `added_by` must be
  you). Pure logic in `src/lib/shopping.ts`.
- **Our own recipes (`/cocktails/new`, tasters only)** -- add drinks beyond
  the Top 100; they're mixed into the list (after the 100, marked ★ "Our
  recipe"), searchable, rateable, and understood by our bar, the shopping
  list and the ingredient filter. The **recipe helper** reads a photo of a
  book page or card, a web link, or pasted text with an AI model via
  OpenRouter (`TIKI_OPEN_ROUTER_API_KEY`, server-only; model
  `google/gemini-3.8-flash`, override with `TIKI_OPENROUTER_MODEL`), and
  fills in a form you check and fix before saving -- nothing is saved
  without review. It keeps the source's amounts, paraphrases the method,
  suggests a catalog style per ingredient, and lists what it wasn't sure
  of. Links are fetched server-side with SSRF protection
  (`src/lib/server/net-guard.ts`: public addresses only, checked at
  connect time; ports 80/443; ≤3 redirects; 2 MB; one 50 s deadline).
  Either taster can edit one of our recipes; only the taster who added it
  can delete it (which also removes both tasters' ratings for it). The
  verified Top 100 and IBA drinks stay read-only (migration 0008: RLS + column grants).
- **Recipe from a menu (`/cocktails/new` → "From a menu")** -- type what a
  bar menu says (ingredients, no amounts), optionally the drink name, the
  bar, and/or a photo of the menu. The recipe helper works out plausible
  amounts from the ratios in our own tested recipes (sent as a compact
  library; other guesses are left out) and classic drink structures, with
  an optional web search (OpenRouter's web plugin, a few cents). The review
  shows how it got there: its reasoning, links to the recipes of ours it
  leaned on (names checked against our list), and the web pages it read
  (from the API's citations only; never saved as the recipe's link). Saved
  guesses carry a **Best guess** badge on the card and in the list
  (`cocktails.is_guess`, migration 0010: only our recipes can be guesses);
  untick it in the editor once you've tasted and adjusted it.
- **Sign-in & editing** -- see below.

### Signing in & saving ratings

JB and GM sign in with email + password (Supabase Auth) and can then add
or edit **their own** rating, date and notes from any recipe card
(`/cocktails/[slug]/tasting/[jb|gm]`). You stay signed in until you sign
out: the session cookie lasts 400 days and `src/proxy.ts` refreshes the
token on each visit (`src/lib/auth/cookies.ts`). Signing out only signs
out that browser.

Who may sign up, and who may edit what, is enforced in the database
(`supabase/migrations/0003_taster_auth.sql`): only emails listed in
`taster_accounts` can create an account, and RLS lets a signed-in taster
insert/update only their own tastings. Emails are kept out of git; add one
with:

```sql
insert into public.taster_accounts (taster_id, email)
select id, 'someone@example.com' from public.tasters where initials = 'GM';
```

One-time Supabase setup (Dashboard → Authentication):

- **URL Configuration:** set **Site URL** to the live site and add
  `https://<live-site>/**` and `http://localhost:3000/**` to **Redirect
  URLs** (no `*.vercel.app` wildcards), so confirmation and reset emails
  link back to the app.
- **Sign In / Providers → Email:** keep **Confirm email** ON (it proves the
  person owns the address) and set **minimum password length** to 8 to
  match the app.
- Once JB and GM have both created accounts, turn **Allow new users to
  sign up** OFF. The allow-list trigger stays as a backstop.
- Leave session time-box / inactivity timeout off (so sign-ins persist).
- Recommended: turn on **Secure password change** (Sign In / Providers →
  Email). The app only offers the change-password form right after a reset
  email link, but that's a convenience guard; this setting is what actually
  stops a stolen session from changing the password.
- Leaked-password protection is Pro-plan only, so it's off on this project.

## Database setup (fresh project) & backups

Everything needed to rebuild the database is in the repo:

1. Apply `supabase/migrations/0001` … `0012` in order (Supabase SQL editor
   or `supabase db push`). 0012 (the IBA drinks and collections) is
   generated from `seed-data/iba-cocktails.json` and
   `seed-data/collections.json` by `node scripts/generate-collections-sql.mjs`
   (a unit test checks it's up to date). Note: 0012's Tiki step files every
   Difford's row -- so on a fresh project, run the migrations up to 0011,
   then `supabase/seed.sql`, then 0012.
2. Run `supabase/seed.sql` -- the two tasters, the 100 verified cocktails
   (with slugs) and the launch tasting log. It's generated from
   `seed-data/cocktails.json` by `npm run db:seed-sql`.
3. Add the taster emails to `taster_accounts` (SQL above).

Ratings entered in the app since launch live only in Supabase. To back them
up, export the `tastings` table as CSV (Dashboard → Table Editor → tastings
→ Export), or `pg_dump` with the connection string from Dashboard → Connect.

## Testing

```bash
npm test            # unit tests (Vitest)
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run test:e2e    # end-to-end tests (Playwright; run `npx playwright install chromium` first)
```

e2e needs ports 3100 (app) and 54329 (mock database) free. To use an
already-installed Chromium instead of downloading one, set
`PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome`. The suite covers every page on
desktop and a Pixel 7 viewport, sign-in flows, editing, an axe WCAG 2.1 AA
scan of every page (`e2e/a11y.spec.ts`), and "database down" error states
(`e2e/db-down.spec.ts`, which runs last because it flips the shared mock).

The e2e suite never touches the real database: `playwright.config.ts` starts
`e2e/mock-supabase.mjs` (a tiny PostgREST stand-in serving fixtures from
`seed-data/cocktails.json`) and builds the app into a separate `.next-e2e`
dir pointed at it. Running e2e rewrites the gitignored `next-env.d.ts` to
reference `.next-e2e`; the next `npm run dev`/`build` puts it back.

### Colors & contrast

The app uses one deliberate light tropical theme (it doesn't switch to dark
mode). Every text/background pairing in `src/app/globals.css` meets WCAG AA
(4.5:1 for normal text, 3:1 for large text and field outlines), and the
chart colors were checked for colorblind separation -- see the comments in
that file. After changing colors, re-run the e2e suite: the axe scan fails
on any contrast regression.

## Project status

Built in small phases, each unit + e2e tested and reviewed by a dedicated
review pass:

1. ✅ Ingredient audit — verified all 100 cocktails against Difford's Guide
2. ✅ Project scaffolding — Next.js app, tests, repo, first deploy
3. ✅ Database schema & seeding (Supabase)
4. ✅ Core read-only UI — full Top 100 list with All / Tasted / Not yet filter, full-screen recipe cards with "Our tasting" notes
5. ✅ Interactive tasting features — per-taster edit form for rating, date, notes and tried
6. ✅ KPI dashboard & polish — /stats page (progress by Difford's band, John vs Genny, rating spread, where we disagree, favorites), site-wide 404 and error pages
7. ✅ Authentication for registered users — email + password sign-in for JB & GM (allow-listed), edit only your own tastings (RLS), stay signed in until you sign out
8. ✅ Final QA & handoff — axe accessibility scan of every page, "database down" tests, rebuild-from-repo seed script (verified on a fresh Postgres), docs

### Beyond the original plan

9. ✅ Ingredient catalog — tidy styles & families for all 153 recipe wordings, researched example bottles, ingredient browser and pages, Total Wine / WineXpress links
10. ✅ Filter by ingredient — pick ingredients on the home list (all-of / any-of), combined with Tasted / Not yet
11. ✅ Bar cabinet — "Our bar": what we have, what we can make now, what to buy next; markers on recipe cards and ingredient pages
12. ✅ Shopping list — shared list from recipe cards, ingredient pages and our bar; what each item completes, where to buy, "Got it" into our bar
13. ✅ Search & "What to try next" — search box on the list, explainable suggestions on the home page and /next
14. ✅ Our own recipes + AI recipe helper — add from a photo, link or text (reviewed before saving), mixed into the list; edit/delete
15. ✅ Servings & units — 1×–8× and as written / fl oz / ml on every recipe card
16. ✅ Living bar inventory — bottle levels, "We made this" pours (with undo), running-low alerts and restocking
17. ✅ Bar scanner — add bottles from a photo (style, size, estimated level) or from a receipt
18. ✅ Recipe from a menu — a best-guess recipe from a menu listing, using our recipes' ratios (+ optional web search), badged until tested
19. ✅ Equal Parts: collections — renamed from Adventures in Tiki; Tiki, Classics (the 102 IBA official cocktails) and Prohibition collections, add/rename your own, per-collection stats; 42 new catalog styles for the classics (vermouths, whiskeys, liqueurs…)

## Future ideas (not yet scheduled)

Captured from John so they don't get lost, in the order he picked (Sep 2026):

1. Style tags -- structure (sour, stirred, highball…), base spirit and a few
   flavor words, suggested by the recipe helper and reviewed; filters like
   "stirred + whiskey".
2. Suggestions from our ratings -- "what next" leans toward the styles each
   of us rates highly, and says why; a "surprise me" stretch pick.
3. Broader bar -- open-bottle freshness (vermouth), homemade syrups with a
   made-on date, substitutions ("out of Campari? use Aperol").
4. Hosting extras -- batching for a pitcher or punch bowl (with dilution),
   party prep lists, cost per drink.
- Smaller ideas: Add to Home Screen (PWA), photos on tastings, progress
  over time
