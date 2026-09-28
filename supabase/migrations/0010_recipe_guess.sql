-- "Recipe from a menu": our own recipes can be marked as a best guess (worked
-- out from a menu description, not a tested recipe), shown with a badge.
--
--  * Only our own recipes can be guesses; Difford's rows never are.
--  * Tasters can set it when adding a recipe and clear it after tasting,
--    through the same column grants as the other recipe fields.

alter table public.cocktails
  add column is_guess boolean not null default false;

alter table public.cocktails add constraint cocktails_guess_is_ours
  check (not is_guess or source = 'ours');

grant insert (is_guess) on public.cocktails to authenticated;
grant update (is_guess) on public.cocktails to authenticated;
