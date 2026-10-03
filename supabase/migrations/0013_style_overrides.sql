-- Style tags: computed in the app from each drink's verified ingredients
-- (src/lib/styles.ts). Tasters can fix a drink's tags; each fix is stored
-- here as an override: include = true adds a tag the rules missed,
-- include = false removes one they got wrong.

create table public.cocktail_style_overrides (
  cocktail_id uuid not null references public.cocktails(id) on delete cascade,
  tag text not null check (tag ~ '^[a-z]+(-[a-z]+)*$' and char_length(tag) <= 30),
  include boolean not null,
  updated_by uuid references public.tasters(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (cocktail_id, tag)
);

alter table public.cocktail_style_overrides enable row level security;

create policy "Anyone can read style fixes" on public.cocktail_style_overrides
  for select to anon, authenticated using (true);
create policy "Tasters can add style fixes" on public.cocktail_style_overrides
  for insert to authenticated
  with check (updated_by = (select public.current_taster_id()));
create policy "Tasters can change style fixes" on public.cocktail_style_overrides
  for update to authenticated
  using ((select public.current_taster_id()) is not null)
  with check (updated_by = (select public.current_taster_id()));
create policy "Tasters can remove style fixes" on public.cocktail_style_overrides
  for delete to authenticated
  using ((select public.current_taster_id()) is not null);

revoke all on public.cocktail_style_overrides from anon, authenticated;
grant select on public.cocktail_style_overrides to anon, authenticated;
grant insert (cocktail_id, tag, include, updated_by) on public.cocktail_style_overrides to authenticated;
-- (An upsert's "do update" sets every column it was sent, so the key columns need the grant too.)
grant update (cocktail_id, tag, include, updated_by) on public.cocktail_style_overrides to authenticated;
grant delete on public.cocktail_style_overrides to authenticated;

-- Keep updated_at honest on upserts.
create function public.touch_style_override()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger cocktail_style_overrides_touch before update on public.cocktail_style_overrides
  for each row execute function public.touch_style_override();
