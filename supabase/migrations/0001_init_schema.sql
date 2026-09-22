-- Adventures in Tiki Tracker -- initial schema
--
-- Design notes:
--  * `tastings` is normalized one-row-per-(cocktail, taster) rather than
--    flat jb_rating/gm_rating columns on `cocktails`, because the project
--    plan calls for real registered-user auth later (Phase 7) -- JB and GM
--    becoming actual accounts that each independently rate a cocktail.
--    This shape needs no migration when that happens; `tasters.id` is
--    already the foreign key we'll eventually point at auth.users.
--  * Ranking/averaging math intentionally stays in the app's tested
--    src/lib/tasting.ts (competition rank, ties share & skip -- see that
--    file's comments) rather than being reimplemented in SQL, to avoid
--    two sources of truth for the same formulas.
--  * RLS is enabled on every table with public SELECT only. There is no
--    write policy yet: until Phase 7 auth exists, all writes (including
--    seeding) go through the Supabase service role / SQL editor, never
--    the app's anon key.

create table public.tasters (
  id uuid primary key default gen_random_uuid(),
  initials text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

comment on table public.tasters is 'People who taste and rate cocktails (JB, GM). Will become real auth.users accounts in Phase 7.';

create table public.cocktails (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  diffords_rank integer not null unique check (diffords_rank between 1 and 100),
  diffords_guide_id integer,
  diffords_guide_url text not null,
  primary_spirits text[] not null default '{}',
  glass text,
  garnish text,
  method_summary text,
  ingredients jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cocktails is 'Difford''s Guide Top 100 Tiki & Tropical Cocktails -- ingredients/method independently verified against diffordsguide.com, method_summary paraphrased (not copied) for copyright hygiene.';
comment on column public.cocktails.ingredients is 'Array of {amount, unit, ingredient} objects, in pour order.';

create table public.tastings (
  id uuid primary key default gen_random_uuid(),
  cocktail_id uuid not null references public.cocktails(id) on delete cascade,
  taster_id uuid not null references public.tasters(id) on delete cascade,
  rating numeric(4,2) check (rating >= 0 and rating <= 10),
  notes text,
  tried boolean not null default true,
  tasted_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cocktail_id, taster_id)
);

comment on table public.tastings is 'One row per (cocktail, taster). rating is nullable: a taster can have tried a cocktail without having rated it yet.';

create index tastings_cocktail_id_idx on public.tastings (cocktail_id);
create index tastings_taster_id_idx on public.tastings (taster_id);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger cocktails_set_updated_at
before update on public.cocktails
for each row execute function public.set_updated_at();

create trigger tastings_set_updated_at
before update on public.tastings
for each row execute function public.set_updated_at();

-- Row level security: public read-only for now.
alter table public.tasters enable row level security;
alter table public.cocktails enable row level security;
alter table public.tastings enable row level security;

create policy "Public read access" on public.tasters for select using (true);
create policy "Public read access" on public.cocktails for select using (true);
create policy "Public read access" on public.tastings for select using (true);
