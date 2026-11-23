-- "Our version" of a drink, from a critique: the tasters try a tweaked
-- recipe as a trial, then keep it (it becomes the version shown on the
-- card and used by our bar) or drop it. The verified original in
-- cocktails.ingredients is never changed; "back to the original" just
-- retires our version.
--
--  * At most one trial and one active version per drink (partial unique indexes).
--  * Tasters save trials (as themselves) with save_cocktail_trial and move them
--    along trial -> active -> retired with keep_cocktail_version /
--    retire_cocktail_version (all SECURITY INVOKER, so RLS applies), each one
--    transaction. A trigger allows only those forward moves.

create table public.cocktail_versions (
  id uuid primary key default gen_random_uuid(),
  cocktail_id uuid not null references public.cocktails(id) on delete cascade,
  status text not null default 'trial' check (status in ('trial', 'active', 'retired')),
  ingredients jsonb not null check (
    jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) between 1 and 30
  ),
  method_summary text check (method_summary is null or char_length(method_summary) between 1 and 2000),
  critique text check (critique is null or char_length(critique) between 1 and 800),
  reasoning text check (reasoning is null or char_length(reasoning) between 1 and 2000),
  created_by uuid references public.tasters(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_by uuid references public.tasters(id) on delete set null,
  decided_at timestamptz
);

create unique index cocktail_versions_one_trial on public.cocktail_versions (cocktail_id) where status = 'trial';
create unique index cocktail_versions_one_active on public.cocktail_versions (cocktail_id) where status = 'active';

alter table public.cocktail_versions enable row level security;

create policy "Anyone can read versions" on public.cocktail_versions
  for select to anon, authenticated using (true);
create policy "Tasters can start a trial" on public.cocktail_versions
  for insert to authenticated
  with check (status = 'trial' and created_by = (select public.current_taster_id()));
create policy "Tasters can decide on versions" on public.cocktail_versions
  for update to authenticated
  using ((select public.current_taster_id()) is not null)
  with check (decided_by = (select public.current_taster_id()));

revoke all on public.cocktail_versions from anon, authenticated;
grant select on public.cocktail_versions to anon, authenticated;
grant insert (cocktail_id, ingredients, method_summary, critique, reasoning, created_by) on public.cocktail_versions to authenticated;
grant update (status, decided_by) on public.cocktail_versions to authenticated;

-- Versions only move forward: trial -> active, trial -> retired, active -> retired.
-- (Stops a direct PATCH from reviving a retired version or skipping Keep.)
create function public.check_version_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status or not (
    (old.status = 'trial' and new.status in ('active', 'retired'))
    or (old.status = 'active' and new.status = 'retired')
  ) then
    raise exception 'a version can''t go from % to %', old.status, new.status using errcode = '23514';
  end if;
  new.decided_at := now();
  return new;
end;
$$;
create trigger cocktail_versions_transition before update on public.cocktail_versions
  for each row execute function public.check_version_transition();

-- Save a trial, replacing the current one (if any) in the same transaction.
-- p_replaces is the trial the taster saw (null if none): if another trial
-- has been saved since, nothing changes and it raises 'stale' (P0001).
create function public.save_cocktail_trial(
  p_cocktail_id uuid,
  p_ingredients jsonb,
  p_method_summary text,
  p_critique text,
  p_reasoning text,
  p_replaces uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_me uuid := public.current_taster_id();
  v_current uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'not a taster' using errcode = '42501';
  end if;
  select id into v_current from public.cocktail_versions
    where cocktail_id = p_cocktail_id and status = 'trial'
    for update;
  if v_current is distinct from p_replaces then
    raise exception 'stale' using errcode = 'P0001';
  end if;
  if v_current is not null then
    update public.cocktail_versions set status = 'retired', decided_by = v_me where id = v_current;
  end if;
  insert into public.cocktail_versions (cocktail_id, ingredients, method_summary, critique, reasoning, created_by)
    values (p_cocktail_id, p_ingredients, p_method_summary, p_critique, p_reasoning, v_me)
    returning id into v_id;
  return v_id;
end;
$$;

-- Keep a trial: it becomes the active version (the old active one is retired).
create function public.keep_cocktail_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cocktail uuid;
  v_me uuid := public.current_taster_id();
begin
  if v_me is null then
    raise exception 'not a taster' using errcode = '42501';
  end if;
  -- Lock the trial so a Drop or a replacing save can't slip in between.
  select cocktail_id into v_cocktail from public.cocktail_versions
    where id = p_version_id and status = 'trial'
    for update;
  if v_cocktail is null then
    raise exception 'no such trial' using errcode = 'P0002';
  end if;
  update public.cocktail_versions
    set status = 'retired', decided_by = v_me
    where cocktail_id = v_cocktail and status = 'active';
  update public.cocktail_versions
    set status = 'active', decided_by = v_me
    where id = p_version_id and status = 'trial';
end;
$$;

-- Drop a trial, or retire our version (back to the original recipe).
create function public.retire_cocktail_version(p_version_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_me uuid := public.current_taster_id();
begin
  if v_me is null then
    raise exception 'not a taster' using errcode = '42501';
  end if;
  update public.cocktail_versions
    set status = 'retired', decided_by = v_me
    where id = p_version_id and status in ('trial', 'active');
  return found;
end;
$$;

revoke execute on function public.save_cocktail_trial(uuid, jsonb, text, text, text, uuid) from public, anon;
revoke execute on function public.keep_cocktail_version(uuid) from public, anon;
revoke execute on function public.retire_cocktail_version(uuid) from public, anon;
grant execute on function public.save_cocktail_trial(uuid, jsonb, text, text, text, uuid) to authenticated;
grant execute on function public.keep_cocktail_version(uuid) to authenticated;
grant execute on function public.retire_cocktail_version(uuid) to authenticated;
