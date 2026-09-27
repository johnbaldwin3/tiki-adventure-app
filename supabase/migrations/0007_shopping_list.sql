-- Shopping list: ingredients JB & GM mean to buy (one shared list), shown
-- with what each would let us make and where to find it. "Got it" moves an
-- item into the bar cabinet (0006).
--
--  * ingredient_id is a catalog style id from src/data/ingredients.ts
--    (format-checked, not a foreign key -- the catalog lives in code).
--  * Only signed-in tasters can see or change it; added_by must be the
--    signed-in taster.

create table public.shopping_items (
  ingredient_id text primary key check (
    char_length(ingredient_id) <= 64 and ingredient_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  added_by uuid references public.tasters(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.shopping_items is 'Ingredients (catalog style ids) on our shopping list. Visible/editable by signed-in tasters only.';

-- created_at is always the server's clock, never the client's.
create or replace function public.set_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at = now();
  return new;
end;
$$;

create trigger shopping_items_set_created_at
before insert on public.shopping_items
for each row execute function public.set_created_at();

create index shopping_items_added_by_idx on public.shopping_items (added_by);
-- Covers cabinet_items' foreign key too (Supabase performance advisor).
create index cabinet_items_updated_by_idx on public.cabinet_items (updated_by);

alter table public.shopping_items enable row level security;

revoke all on public.shopping_items from anon;

create policy "Tasters can read the shopping list"
on public.shopping_items for select
to authenticated
using ((select public.current_taster_id()) is not null);

create policy "Tasters can add to the shopping list"
on public.shopping_items for insert
to authenticated
with check (added_by = (select public.current_taster_id()));

create policy "Tasters can remove from the shopping list"
on public.shopping_items for delete
to authenticated
using ((select public.current_taster_id()) is not null);
