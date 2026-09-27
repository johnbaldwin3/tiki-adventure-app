-- Living bar inventory: how much is left in each bottle, and a log of
-- drinks made ("We made this") that pours it down.
--
--  * cabinet_items.size_ml / remaining_ml: optional; null remaining = not
--    tracked. Set on /cabinet/levels (and later by bottle photos).
--  * pours: one row per "We made this" (drink, servings, ml per ingredient
--    style), so it can be undone.
--  * record_pour / undo_pour are the only way to write pours: they check the
--    caller is a taster, validate every line, lock the bottles they touch
--    (in a fixed order, so concurrent pours can't deadlock or lose updates),
--    record what was actually taken from each tracked bottle (never below
--    empty), and undo restores exactly that. A client-supplied pour id makes
--    a double-submitted "We made this" count once.

alter table public.cabinet_items
  add column size_ml numeric(6, 1) check (size_ml is null or (size_ml >= 10 and size_ml <= 5000)),
  add column remaining_ml numeric(6, 1) check (remaining_ml is null or (remaining_ml >= 0 and remaining_ml <= 5000));

alter table public.cabinet_items add constraint cabinet_items_remaining_within_size
  check (remaining_ml is null or size_ml is null or remaining_ml <= size_ml);

create table public.pours (
  id uuid primary key,
  cocktail_id uuid references public.cocktails(id) on delete set null,
  servings integer not null check (servings between 1 and 12),
  -- [{"ingredient_id": "navy-rum", "ml": 90, "taken_ml": 90}, ...]
  -- ml = what the recipe pours; taken_ml = what came out of a tracked
  -- bottle (0 if untracked, less if it ran out) -- what undo puts back.
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) <= 30),
  poured_by uuid references public.tasters(id) on delete set null,
  poured_at timestamptz not null default now()
);

comment on table public.pours is 'Drinks made ("We made this"): what was poured and taken from each tracked bottle, so the bar inventory counts down (and can be undone). Written only by record_pour/undo_pour; tasters can read.';

create index pours_cocktail_id_idx on public.pours (cocktail_id);
create index pours_poured_by_idx on public.pours (poured_by);

alter table public.pours enable row level security;
revoke all on public.pours from anon, authenticated;
grant select on public.pours to authenticated;

create policy "Tasters can read pours"
on public.pours for select
to authenticated
using ((select public.current_taster_id()) is not null);

-- Records a pour (idempotent per p_pour_id) and counts tracked bottles down.
-- SECURITY DEFINER (like current_taster_id): runs as the owner, so it checks
-- the caller is a taster itself; search_path is empty and every name is
-- schema-qualified.
create or replace function public.record_pour(p_pour_id uuid, p_cocktail_id uuid, p_servings integer, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_taster_id();
  line jsonb;
  item record;
  have numeric;
  taken numeric;
  recorded jsonb := '[]'::jsonb;
begin
  if me is null then
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

  -- One row per style (duplicates summed), locked in id order.
  for item in
    select value->>'ingredient_id' as ingredient_id, round(sum((value->>'ml')::numeric), 1) as ml
    from jsonb_array_elements(p_lines)
    group by 1
    order by 1
  loop
    select c.remaining_ml into have
    from public.cabinet_items c
    where c.ingredient_id = item.ingredient_id
    for update;
    taken := case when have is null then 0 else least(have, item.ml) end;
    if taken > 0 then
      update public.cabinet_items
      set remaining_ml = have - taken, updated_by = me
      where ingredient_id = item.ingredient_id;
    end if;
    recorded := recorded || jsonb_build_object('ingredient_id', item.ingredient_id, 'ml', item.ml, 'taken_ml', taken);
  end loop;

  insert into public.pours (id, cocktail_id, servings, lines, poured_by)
  values (p_pour_id, p_cocktail_id, p_servings, recorded, me);
  return p_pour_id;
end;
$$;

-- Undoes a pour: puts back exactly what was taken (never above the bottle
-- size), then deletes the log row. False if it was already undone.
create or replace function public.undo_pour(p_pour_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_taster_id();
  pour_lines jsonb;
  item record;
begin
  if me is null then
    raise exception 'not a taster' using errcode = '42501';
  end if;
  delete from public.pours where id = p_pour_id returning lines into pour_lines;
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
      where ingredient_id = item.ingredient_id
        and remaining_ml is not null;
    end if;
  end loop;
  return true;
end;
$$;

revoke execute on function public.record_pour(uuid, uuid, integer, jsonb) from public, anon;
revoke execute on function public.undo_pour(uuid) from public, anon;
grant execute on function public.record_pour(uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.undo_pour(uuid) to authenticated;
