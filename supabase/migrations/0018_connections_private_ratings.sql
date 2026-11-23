-- Friends & family, step 2b: friends (connections) and private ratings.
--
-- Who you can see: everyone in your household, plus the households of
-- anyone connected to someone in your household. Only they show up in tasters, their tastings
-- are the only ones you can read, and their own recipes ("ours") are the
-- only home-made ones in your list. Signed-out visitors see the catalog
-- and recipes, but no ratings and no one's own recipes.
-- Connections are made by invites / admins in a later step; this adds the
-- table and the rules.

create table public.connections (
  taster_a uuid not null references public.tasters(id) on delete cascade,
  taster_b uuid not null references public.tasters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (taster_a, taster_b),
  -- One row per pair, stored in id order.
  check (taster_a < taster_b)
);

comment on table public.connections is 'Friends: two tasters who can see each other''s ratings (and so can their households). One row per pair, taster_a < taster_b.';

create index connections_taster_b_idx on public.connections (taster_b);

alter table public.connections enable row level security;
revoke all on public.connections from anon, authenticated;
grant select on public.connections to authenticated;
grant all on public.connections to service_role;

-- Everyone the signed-in taster may see: their household, and every
-- household with a member connected to someone in it (a friend of John
-- sees Genny too, and the friend's partner sees both). Empty when signed out.
create function public.visible_taster_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select t.id from public.tasters t
    where t.household_id = public.current_household_id()
  ),
  households as (
    select public.current_household_id() as id
    union
    select f.household_id
    from public.connections c
    join public.tasters f on f.id = case when c.taster_a in (select id from mine) then c.taster_b else c.taster_a end
    where c.taster_a in (select id from mine) or c.taster_b in (select id from mine)
  )
  select t.id from public.tasters t join households h on h.id = t.household_id
$$;

revoke execute on function public.visible_taster_ids() from public;
-- anon too: the cocktails policy below calls it for everyone (it returns nothing when signed out).
grant execute on function public.visible_taster_ids() to anon, authenticated, service_role;

create policy "Households see their own connections" on public.connections for select to authenticated
  using (
    taster_a in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
    or taster_b in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
  );

-- Tasters: only the people you can see.
drop policy "Public read access" on public.tasters;
create policy "See your household and friends" on public.tasters for select to authenticated
  using (id in (select public.visible_taster_ids()));

-- Tastings: only theirs.
drop policy "Public read access" on public.tastings;
create policy "See your household's and friends' tastings" on public.tastings for select to authenticated
  using (taster_id in (select public.visible_taster_ids()));

-- Cocktails: the catalog is public; a home-made recipe only for its
-- household and their friends.
drop policy "Public read access" on public.cocktails;
create policy "Catalog for everyone, own recipes for household and friends" on public.cocktails for select to anon, authenticated
  using (source <> 'ours' or added_by in (select public.visible_taster_ids()));

-- Versions follow their drink (a stranger's home-made recipe stays hidden).
drop policy "Anyone can read versions" on public.cocktail_versions;
create policy "Read versions of drinks you can see" on public.cocktail_versions for select to anon, authenticated
  using (cocktail_id in (select c.id from public.cocktails c));
