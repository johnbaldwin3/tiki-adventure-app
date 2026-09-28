-- Collections ("genres") and a third recipe source, the IBA official list.
--
--  * cocktails.source gains 'iba': verified rows from the International
--    Bartenders Association's official list (seeded by migration 0012), with
--    the IBA page as source_url and its IBA category as source_note. Like
--    Difford's rows they're read-only (the policies from 0008 only let
--    tasters write source = 'ours').
--  * collections: Tiki, Classics, Prohibition to start (built_in: can't be
--    deleted); tasters can add, rename and remove others (either taster can
--    remove any collection that isn't built in).
--  * cocktail_collections: which drinks are in which collection, with an
--    optional note and source link (e.g. a drink's Prohibition-era story).
--  * Everyone can read collections (the list is public, like cocktails);
--    only tasters can change them.

alter table public.cocktails drop constraint cocktails_source_check;
alter table public.cocktails add constraint cocktails_source_check
  check (source in ('diffords', 'ours', 'iba'));

alter table public.cocktails drop constraint cocktails_source_shape;
alter table public.cocktails add constraint cocktails_source_shape check (
  (source = 'diffords' and diffords_rank is not null and diffords_guide_url is not null)
  or (
    source = 'ours'
    and diffords_rank is null
    and diffords_guide_id is null
    and diffords_guide_url is null
    and slug not in ('new', 'edit') -- app routes under /cocktails/
  )
  or (
    source = 'iba'
    and diffords_rank is null
    and diffords_guide_id is null
    and diffords_guide_url is null
    and source_url is not null
    and added_by is null
  )
);

comment on table public.cocktails is 'Difford''s Guide Top 100 Tiki & Tropical Cocktails (source=diffords), the IBA official cocktails (source=iba), both independently verified with methods paraphrased, plus recipes JB & GM add themselves (source=ours).';

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40 and slug not in ('all', 'new', 'manage')),
  name text not null unique check (char_length(name) between 1 and 40),
  description text check (description is null or char_length(description) between 1 and 300),
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  built_in boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.cocktail_collections (
  cocktail_id uuid not null references public.cocktails(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  note text check (note is null or char_length(note) between 1 and 400),
  note_url text check (note_url is null or (char_length(note_url) <= 500 and note_url ~ '^https?://')),
  added_at timestamptz not null default now(),
  primary key (collection_id, cocktail_id)
);
create index cocktail_collections_cocktail_idx on public.cocktail_collections (cocktail_id);

alter table public.collections enable row level security;
alter table public.cocktail_collections enable row level security;

create policy "Anyone can read collections" on public.collections for select to anon, authenticated using (true);
create policy "Tasters can add collections" on public.collections for insert to authenticated
  with check ((select public.current_taster_id()) is not null and not built_in);
create policy "Tasters can rename collections" on public.collections for update to authenticated
  using ((select public.current_taster_id()) is not null)
  with check ((select public.current_taster_id()) is not null);
create policy "Tasters can remove collections they added" on public.collections for delete to authenticated
  using ((select public.current_taster_id()) is not null and not built_in);

create policy "Anyone can read collection members" on public.cocktail_collections for select to anon, authenticated using (true);
create policy "Tasters can add drinks to collections" on public.cocktail_collections for insert to authenticated
  with check ((select public.current_taster_id()) is not null);
create policy "Tasters can take drinks out of collections" on public.cocktail_collections for delete to authenticated
  using ((select public.current_taster_id()) is not null);

-- Column-level privileges (defence in depth under the policies above).
revoke all on public.collections, public.cocktail_collections from anon, authenticated;
grant select on public.collections, public.cocktail_collections to anon, authenticated;
grant insert (slug, name, description) on public.collections to authenticated;
grant update (name, description) on public.collections to authenticated;
grant delete on public.collections to authenticated;
-- Notes (e.g. the sourced Prohibition stories) come only from the seed data.
grant insert (cocktail_id, collection_id) on public.cocktail_collections to authenticated;
grant delete on public.cocktail_collections to authenticated;
