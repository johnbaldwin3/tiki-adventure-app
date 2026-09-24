# Adventures in Tiki Tracker

A mobile-first tasting log, spirits guide, and ranking tracker for Difford's
Guide's Top 100 Tiki & Tropical Cocktails, built for John (JB) and Genny (GM).

**Live:** https://tiki-adventure-app-beige.vercel.app

Recipe data (ingredients, amounts, glassware, garnish) is independently
verified against each cocktail's actual recipe page on
[diffordsguide.com](https://www.diffordsguide.com/cocktails/directory/styles/tiki-tropical) —
see `seed-data/cocktails.json`. Method descriptions are written in our own
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

- **Home (`/`)** -- progress tiles and all 100 cocktails, filterable by
  All / Tasted / Not yet; tap one for its recipe card.
- **Recipe card (`/cocktails/[slug]`)** -- ingredients, glass, garnish,
  method, "Our tasting" (ratings, dates, notes), and a credit link to the
  original on Difford's Guide.
- **Stats (`/stats`)** -- progress by Difford's rank band, John vs Genny,
  rating spread, where we disagree, favorites.
- **Ingredients (`/ingredients`)** -- every ingredient in the Top 100 as a
  brand-neutral style, grouped by family, with example bottles to look for
  and the drinks that use it. Recipe-card ingredient lines link here. The
  catalog lives in `src/data/ingredients.ts`: each style has a family,
  example brands (for rum, taken from Difford's Guide's product listing for
  the exact style, linked on the page), and "staple" flags for what's
  assumed always on hand (fresh citrus, water/soda/salt, Angostura).
  `INGREDIENT_ALIASES` maps each recipe's exact wording to a style without
  changing the verified recipe text; unit tests fail if any recipe line is
  unmapped.
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

1. Apply `supabase/migrations/0001` … `0005` in order (Supabase SQL editor
   or `supabase db push`).
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

9. ✅ Ingredient catalog — tidy styles & families for all 153 recipe wordings, researched example bottles, ingredient browser and pages

## Future ideas (not yet scheduled)

Captured from John so they don't get lost:

- **Filter by ingredient** -- pick one or more ingredients (from the new
  catalog) and see the drinks that use them
- **Have / don't-have matching** -- find drinks that use ingredients we
  have, and exclude ones needing ingredients we don't (e.g. "missing only
  one ingredient")
- **Virtual bar cabinet** -- keep a saved list of what's actually on the
  shelf at home and list the drinks we can make from it right now (builds
  on the ingredient catalog; needs a `cabinet` table keyed by style id,
  optionally recording which exact bottle we own)
- Smaller ideas: search box, "what should we try next?" suggestions,
  Add to Home Screen (PWA), photos on tastings, progress over time
