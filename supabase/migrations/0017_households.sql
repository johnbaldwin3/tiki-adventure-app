-- Friends & family, step 2a: every taster belongs to a household ("a bar"),
-- and the bar itself -- cabinet, shopping list, pours -- belongs to a
-- household instead of being one global list. JB and GM become one
-- household and the app's two admins. Nothing changes for them: all
-- existing rows move into their household.
--
-- What this tightens (it was "any signed-in taster" before):
--  * cabinet / shopping list / pours: only your own household's rows.
--  * tastings: you may add or edit the tastings of anyone in your household
--    (the 0016 "we tried it" rule), not anyone at all. Reading tastings is
--    still public in this step.
--  * our recipes: editable by the household that added them.
--  * shared catalog extras that everyone sees -- collections, style tag
--    fixes, "our version" trials -- are admin-only for now.
-- Sign-up is unchanged (taster_accounts allow-list); invites come later.

-- Households -------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

comment on table public.households is 'A shared home bar: its members share the cabinet, shopping list and pours, and can enter each other''s tastings.';

alter table public.households enable row level security;
revoke all on public.households from anon, authenticated;
grant select on public.households to authenticated;

alter table public.tasters
  add column household_id uuid references public.households(id) on delete restrict,
  add column is_admin boolean not null default false;

comment on column public.tasters.household_id is 'The household (bar) this taster belongs to.';
comment on column public.tasters.is_admin is 'Can manage members and the shared catalog extras (collections, tag fixes, our versions).';

-- JB & GM: one household, both admins. (Any other taster rows get a
-- household of their own.)
with jbgm as (
  insert into public.households (name) values ('John & Genny') returning id
)
update public.tasters t
set household_id = (select id from jbgm), is_admin = true
where t.initials in ('JB', 'GM');

do $$
declare
  t record;
  h uuid;
begin
  for t in select id, display_name from public.tasters where household_id is null loop
    insert into public.households (name) values (left(t.display_name || '''s bar', 60)) returning id into h;
    update public.tasters set household_id = h where id = t.id;
  end loop;
end;
$$;

alter table public.tasters alter column household_id set not null;
create index tasters_household_id_idx on public.tasters (household_id);

-- Who am I? (Same pattern as current_taster_id: SECURITY DEFINER, so the
-- policies below can call it without reading taster_accounts themselves.)

create function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.household_id
  from public.tasters t
  where t.id = public.current_taster_id()
$$;

create function public.current_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select t.is_admin from public.tasters t where t.id = public.current_taster_id()), false)
$$;

revoke execute on function public.current_household_id() from public, anon;
revoke execute on function public.current_is_admin() from public, anon;
grant execute on function public.current_household_id() to authenticated;
grant execute on function public.current_is_admin() to authenticated;

create policy "Members can see their household" on public.households for select to authenticated
  using (id = (select public.current_household_id()));

-- Cabinet: one row per (household, ingredient) -----------------------------

alter table public.cabinet_items
  add column household_id uuid references public.households(id) on delete cascade;
update public.cabinet_items
  set household_id = (select household_id from public.tasters where initials = 'JB');
alter table public.cabinet_items
  alter column household_id set not null,
  alter column household_id set default public.current_household_id(),
  drop constraint cabinet_items_pkey,
  add primary key (household_id, ingredient_id);

drop policy "Tasters can read the cabinet" on public.cabinet_items;
drop policy "Tasters can add to the cabinet" on public.cabinet_items;
drop policy "Tasters can update the cabinet" on public.cabinet_items;
drop policy "Tasters can remove from the cabinet" on public.cabinet_items;

create policy "Household members can read their cabinet" on public.cabinet_items for select to authenticated
  using (household_id = (select public.current_household_id()));
create policy "Household members can add to their cabinet" on public.cabinet_items for insert to authenticated
  with check (household_id = (select public.current_household_id()) and updated_by = (select public.current_taster_id()));
create policy "Household members can update their cabinet" on public.cabinet_items for update to authenticated
  using (household_id = (select public.current_household_id()))
  with check (household_id = (select public.current_household_id()) and updated_by = (select public.current_taster_id()));
create policy "Household members can remove from their cabinet" on public.cabinet_items for delete to authenticated
  using (household_id = (select public.current_household_id()));

-- Shopping list -----------------------------------------------------------

alter table public.shopping_items
  add column household_id uuid references public.households(id) on delete cascade;
update public.shopping_items
  set household_id = (select household_id from public.tasters where initials = 'JB');
alter table public.shopping_items
  alter column household_id set not null,
  alter column household_id set default public.current_household_id(),
  drop constraint shopping_items_pkey,
  add primary key (household_id, ingredient_id);

drop policy "Tasters can read the shopping list" on public.shopping_items;
drop policy "Tasters can add to the shopping list" on public.shopping_items;
drop policy "Tasters can remove from the shopping list" on public.shopping_items;

create policy "Household members can read their shopping list" on public.shopping_items for select to authenticated
  using (household_id = (select public.current_household_id()));
create policy "Household members can add to their shopping list" on public.shopping_items for insert to authenticated
  with check (household_id = (select public.current_household_id()) and added_by = (select public.current_taster_id()));
create policy "Household members can remove from their shopping list" on public.shopping_items for delete to authenticated
  using (household_id = (select public.current_household_id()));

-- Pours ("We made this") ----------------------------------------------------

alter table public.pours
  add column household_id uuid references public.households(id) on delete cascade;
update public.pours
  set household_id = coalesce(
    (select t.household_id from public.tasters t where t.id = pours.poured_by),
    (select household_id from public.tasters where initials = 'JB')
  );
alter table public.pours alter column household_id set not null;
create index pours_household_id_idx on public.pours (household_id);

drop policy "Tasters can read pours" on public.pours;
create policy "Household members can read their pours" on public.pours for select to authenticated
  using (household_id = (select public.current_household_id()));

-- Same as 0009, but only your own household's bottles count down, and undo
-- only finds your own household's pours.
create or replace function public.record_pour(p_pour_id uuid, p_cocktail_id uuid, p_servings integer, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_taster_id();
  home uuid := public.current_household_id();
  line jsonb;
  item record;
  have numeric;
  taken numeric;
  recorded jsonb := '[]'::jsonb;
begin
  if me is null or home is null then
    raise exception 'not a taster' using errcode = '42501';
  end if;
  if p_pour_id is null or p_servings is null or p_servings < 1 or p_servings > 12 then
    raise exception 'bad pour' using errcode = '22023';
  end if;
  if exists (select 1 from public.pours where id = p_pour_id) then
    return p_pour_id; -- already recorded (double submit)
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) > 30 then
    raise exception 'lines must be an array of at most 30' using errcode = '22023';
  end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(line) is distinct from 'object'
       or jsonb_typeof(line->'ingredient_id') is distinct from 'string'
       or char_length(line->>'ingredient_id') > 64
       or (line->>'ingredient_id') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
       or jsonb_typeof(line->'ml') is distinct from 'number'
       or (line->>'ml')::numeric <= 0
       or (line->>'ml')::numeric > 20000 then
      raise exception 'bad pour line %', line using errcode = '22023';
    end if;
  end loop;

  for item in
    select value->>'ingredient_id' as ingredient_id, round(sum((value->>'ml')::numeric), 1) as ml
    from jsonb_array_elements(p_lines)
    group by 1
    order by 1
  loop
    select c.remaining_ml into have
    from public.cabinet_items c
    where c.household_id = home and c.ingredient_id = item.ingredient_id
    for update;
    taken := case when have is null then 0 else least(have, item.ml) end;
    if taken > 0 then
      update public.cabinet_items
      set remaining_ml = have - taken, updated_by = me
      where household_id = home and ingredient_id = item.ingredient_id;
    end if;
    recorded := recorded || jsonb_build_object('ingredient_id', item.ingredient_id, 'ml', item.ml, 'taken_ml', taken);
  end loop;

  insert into public.pours (id, cocktail_id, servings, lines, poured_by, household_id)
  values (p_pour_id, p_cocktail_id, p_servings, recorded, me, home);
  return p_pour_id;
end;
$$;

create or replace function public.undo_pour(p_pour_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_taster_id();
  home uuid := public.current_household_id();
  pour_lines jsonb;
  item record;
begin
  if me is null or home is null then
    raise exception 'not a taster' using errcode = '42501';
  end if;
  delete from public.pours where id = p_pour_id and household_id = home returning lines into pour_lines;
  if pour_lines is null then
    return false;
  end if;
  for item in
    select value->>'ingredient_id' as ingredient_id, coalesce((value->>'taken_ml')::numeric, 0) as taken
    from jsonb_array_elements(pour_lines)
    order by 1
  loop
    if item.taken > 0 then
      update public.cabinet_items
      set remaining_ml = least(coalesce(size_ml, 99999), remaining_ml + item.taken), updated_by = me
      where household_id = home
        and ingredient_id = item.ingredient_id
        and remaining_ml is not null;
    end if;
  end loop;
  return true;
end;
$$;

-- Tastings: write for anyone in your household --------------------------------

drop policy "Tasters can add tastings" on public.tastings;
drop policy "Tasters can update tastings" on public.tastings;

create policy "Household members can add tastings" on public.tastings for insert to authenticated
  with check (
    taster_id in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
  );
create policy "Household members can update tastings" on public.tastings for update to authenticated
  using (
    taster_id in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
  )
  with check (
    taster_id in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
  );

-- Our recipes: the household that added one can edit it ------------------------

drop policy "Tasters can edit our recipes" on public.cocktails;
create policy "The adding household can edit our recipes" on public.cocktails for update to authenticated
  using (
    source = 'ours'
    and added_by in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
  )
  with check (
    source = 'ours'
    and added_by in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
  );

-- Shared catalog extras: admins only for now ---------------------------------------

drop policy "Tasters can add collections" on public.collections;
drop policy "Tasters can rename collections" on public.collections;
drop policy "Tasters can remove collections they added" on public.collections;
create policy "Admins can add collections" on public.collections for insert to authenticated
  with check ((select public.current_is_admin()) and not built_in);
create policy "Admins can rename collections" on public.collections for update to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()));
create policy "Admins can remove collections" on public.collections for delete to authenticated
  using ((select public.current_is_admin()) and not built_in);

drop policy "Tasters can add drinks to collections" on public.cocktail_collections;
drop policy "Tasters can take drinks out of collections" on public.cocktail_collections;
create policy "Admins can add drinks to collections" on public.cocktail_collections for insert to authenticated
  with check ((select public.current_is_admin()));
create policy "Admins can take drinks out of collections" on public.cocktail_collections for delete to authenticated
  using ((select public.current_is_admin()));

drop policy "Tasters can add style fixes" on public.cocktail_style_overrides;
drop policy "Tasters can change style fixes" on public.cocktail_style_overrides;
drop policy "Tasters can remove style fixes" on public.cocktail_style_overrides;
create policy "Admins can add style fixes" on public.cocktail_style_overrides for insert to authenticated
  with check ((select public.current_is_admin()) and updated_by = (select public.current_taster_id()));
create policy "Admins can change style fixes" on public.cocktail_style_overrides for update to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()) and updated_by = (select public.current_taster_id()));
create policy "Admins can remove style fixes" on public.cocktail_style_overrides for delete to authenticated
  using ((select public.current_is_admin()));

drop policy "Tasters can start a trial" on public.cocktail_versions;
drop policy "Tasters can decide on versions" on public.cocktail_versions;
create policy "Admins can start a trial" on public.cocktail_versions for insert to authenticated
  with check ((select public.current_is_admin()) and status = 'trial' and created_by = (select public.current_taster_id()));
create policy "Admins can decide on versions" on public.cocktail_versions for update to authenticated
  using ((select public.current_is_admin()))
  with check ((select public.current_is_admin()) and decided_by = (select public.current_taster_id()));
