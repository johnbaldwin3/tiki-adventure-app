-- Our own recipes, added alongside Difford's Top 100 (e.g. imported with
-- the AI helper from text, a photo or a link, then reviewed by a taster).
--
--  * source = 'diffords' for the verified Top 100 (must have a rank and a
--    Difford's Guide link), 'ours' for anything we add (no rank).
--  * source_url / source_note say where one of ours came from (a web page,
--    or e.g. "Smuggler's Cove, p. 112").
--  * Ingredient lines may carry a catalog_id (a style id from
--    src/data/ingredients.ts) so our bar, the shopping list and the
--    ingredient filter understand them; the app validates it.
--  * Tasters can add and edit only 'ours' rows; only the taster who added
--    a recipe can delete it (deleting also removes both tasters' ratings
--    and notes for it). The Top 100 stays read-only (seeded by SQL only).
--  * Column grants limit what the API can write at all: never Difford's
--    fields, ids or timestamps; on update, never source/slug/added_by.

alter table public.cocktails
  add column source text not null default 'diffords' check (source in ('diffords', 'ours')),
  add column source_url text check (
    source_url is null or (char_length(source_url) <= 500 and source_url ~ '^https?://')
  ),
  add column source_note text check (source_note is null or char_length(source_note) between 1 and 200),
  add column added_by uuid references public.tasters(id) on delete set null;

alter table public.cocktails alter column diffords_rank drop not null;
alter table public.cocktails alter column diffords_guide_url drop not null;

alter table public.cocktails add constraint cocktails_source_shape check (
  (source = 'diffords' and diffords_rank is not null and diffords_guide_url is not null)
  or (
    source = 'ours'
    and diffords_rank is null
    and diffords_guide_id is null
    and diffords_guide_url is null
    and slug not in ('new', 'edit') -- app routes under /cocktails/
  )
);

-- Sane sizes for anything typed in (the Top 100 already fits these).
alter table public.cocktails add constraint cocktails_text_limits check (
  char_length(name) between 1 and 80
  and (glass is null or char_length(glass) <= 200)
  and (garnish is null or char_length(garnish) <= 300)
  and (method_summary is null or char_length(method_summary) <= 2000)
  and jsonb_typeof(ingredients) = 'array'
  and jsonb_array_length(ingredients) <= 30
  and cardinality(primary_spirits) <= 6
);

create index cocktails_added_by_idx on public.cocktails (added_by);

comment on table public.cocktails is 'Difford''s Guide Top 100 Tiki & Tropical Cocktails (source=diffords; ingredients/method independently verified, method paraphrased) plus recipes JB & GM add themselves (source=ours).';
comment on column public.cocktails.ingredients is 'Array of {amount, unit, ingredient, catalog_id?} objects, in pour order.';

create policy "Tasters can add our recipes"
on public.cocktails for insert
to authenticated
with check (source = 'ours' and added_by = (select public.current_taster_id()));

create policy "Tasters can edit our recipes"
on public.cocktails for update
to authenticated
using (source = 'ours' and (select public.current_taster_id()) is not null)
with check (source = 'ours' and (select public.current_taster_id()) is not null);

create policy "The taster who added a recipe can delete it"
on public.cocktails for delete
to authenticated
using (source = 'ours' and added_by = (select public.current_taster_id()));

-- Column-level privileges (defence in depth under the policies above).
revoke insert, update, delete on public.cocktails from anon;
revoke insert, update on public.cocktails from authenticated;
grant insert (name, slug, primary_spirits, glass, garnish, method_summary, ingredients, source, source_url, source_note, added_by)
  on public.cocktails to authenticated;
grant update (name, primary_spirits, glass, garnish, method_summary, ingredients, source_url, source_note)
  on public.cocktails to authenticated;
grant delete on public.cocktails to authenticated;
