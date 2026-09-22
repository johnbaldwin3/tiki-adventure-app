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
key, which only has public SELECT access (see
`supabase/migrations/0001_init_schema.sql`) -- there is no write access
from the client until Phase 7 auth lands.

## Testing

```bash
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright; run `npx playwright install` first)
```

## Project status

This app is being built in small, reviewed phases:

1. ✅ Ingredient audit — verified all 100 cocktails against Difford's Guide
2. ✅ Project scaffolding — Next.js app, tests, repo, first deploy
3. ✅ Database schema & seeding (Supabase)
4. ⬜ Core read-only UI (cocktail list, recipe cards)
5. ⬜ Interactive tasting features (ratings, notes, tried toggle)
6. ⬜ KPI dashboard & polish
7. ⬜ Authentication for registered users
8. ⬜ Final QA & handoff
