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

### Signing in & saving ratings (Phase 7)

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

## Testing

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright; run `npx playwright install` first)
```

The e2e suite never touches the real database: `playwright.config.ts` starts
`e2e/mock-supabase.mjs` (a tiny PostgREST stand-in serving fixtures from
`seed-data/cocktails.json`) and builds the app into a separate `.next-e2e`
dir pointed at it. Running e2e rewrites the gitignored `next-env.d.ts` to
reference `.next-e2e`; the next `npm run dev`/`build` puts it back.

## Project status

This app is being built in small, reviewed phases:

1. ✅ Ingredient audit — verified all 100 cocktails against Difford's Guide
2. ✅ Project scaffolding — Next.js app, tests, repo, first deploy
3. ✅ Database schema & seeding (Supabase)
4. ✅ Core read-only UI — full Top 100 list with All / Tasted / Not yet filter, full-screen recipe cards with "Our tasting" notes
5. ✅ Interactive tasting features — per-taster edit form for rating, date, notes and tried
6. ✅ KPI dashboard & polish — /stats page (progress by Difford's band, John vs Genny, rating spread, where we disagree, favorites), site-wide 404 and error pages
7. ✅ Authentication for registered users — email + password sign-in for JB & GM (allow-listed), edit only your own tastings (RLS), stay signed in until you sign out
8. ⬜ Final QA & handoff

## Future ideas (not yet scheduled)

Captured from John so they don't get lost -- to be slotted into phases later:

- **Add rating / add notes** right from each recipe card (Phase 4 covers the
  core of this; the card's "Our tasting" section is where it will live)
- **Filter by ingredient** -- pick from a list of every ingredient used
  across the 100 cocktails and see the drinks that use them
- **Have / don't-have matching** -- find drinks that use ingredients we
  have, and exclude ones needing ingredients we don't (e.g. "missing only
  one ingredient")
- **Virtual bar cabinet** -- keep a saved list of what's actually on the
  shelf at home and list the drinks we can make from it right now. Will
  likely need ingredient names normalized into a canonical list (e.g.
  "Light white rum" vs brand-specific entries) and a `cabinet` table
