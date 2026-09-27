-- Bar cabinet: the bottles JB & GM have at home (one shared household
-- cabinet), used to show what they can make now and what to buy next.
--
--  * ingredient_id is a catalog style id from src/data/ingredients.ts (the
--    catalog lives in code, so this is format-checked, not a foreign key;
--    the app ignores ids the catalog doesn't know).
--  * bottle is the exact bottle owned (optional), e.g. "Smith & Cross".
--  * Only signed-in tasters can see or change it (it's our home inventory,
--    not public like the tasting log). updated_by must be the signed-in
--    taster.

create table public.cabinet_items (
  ingredient_id text primary key check (
    char_length(ingredient_id) <= 64 and ingredient_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  bottle text check (bottle is null or (char_length(bottle) <= 120 and btrim(bottle) <> '')),
  updated_by uuid references public.tasters(id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.cabinet_items is 'Ingredients (catalog style ids) we have at home, optionally with the exact bottle. Visible/editable by signed-in tasters only.';

-- On insert too, so updated_at can't be set by the client.
create trigger cabinet_items_set_updated_at
before insert or update on public.cabinet_items
for each row execute function public.set_updated_at();

alter table public.cabinet_items enable row level security;

-- Belt and braces: anon has no business here even before RLS.
revoke all on public.cabinet_items from anon;

create policy "Tasters can read the cabinet"
on public.cabinet_items for select
to authenticated
using ((select public.current_taster_id()) is not null);

create policy "Tasters can add to the cabinet"
on public.cabinet_items for insert
to authenticated
with check (updated_by = (select public.current_taster_id()));

create policy "Tasters can update the cabinet"
on public.cabinet_items for update
to authenticated
using ((select public.current_taster_id()) is not null)
with check (updated_by = (select public.current_taster_id()));

create policy "Tasters can remove from the cabinet"
on public.cabinet_items for delete
to authenticated
using ((select public.current_taster_id()) is not null);
