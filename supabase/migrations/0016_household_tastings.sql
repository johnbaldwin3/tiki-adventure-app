-- Either taster can record a tasting for the other (John asked: "we tried
-- it" together, or add the other's rating), so the write policies become
-- household-wide: any signed-in taster may add or update any tasting.
-- Who last wrote each row is kept in entered_by, set here by a trigger from
-- the signed-in taster (the app can't forge it), so the card can say
-- "entered by JB" on Genny's rating.

alter table public.tastings
  add column entered_by uuid references public.tasters(id) on delete set null;

comment on column public.tastings.entered_by is 'Taster who last saved this row (set by trigger from the signed-in user); differs from taster_id when one taster entered the other''s tasting.';

create function public.set_tasting_entered_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.entered_by := public.current_taster_id();
  return new;
end;
$$;

create trigger tastings_set_entered_by
before insert or update on public.tastings
for each row execute function public.set_tasting_entered_by();

drop policy "Tasters can add their own tastings" on public.tastings;
drop policy "Tasters can update their own tastings" on public.tastings;

create policy "Tasters can add tastings"
on public.tastings for insert
to authenticated
with check ((select public.current_taster_id()) is not null);

create policy "Tasters can update tastings"
on public.tastings for update
to authenticated
using ((select public.current_taster_id()) is not null)
with check ((select public.current_taster_id()) is not null);
