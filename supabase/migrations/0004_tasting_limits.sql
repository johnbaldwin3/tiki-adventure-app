-- Now that tasters can write their own tastings directly (Phase 7), mirror
-- the app's validation (src/lib/tasting-form.ts) in the database so a
-- request that bypasses the app can't store oversized notes or a tasting
-- date in the future. rating's 0-10 range is already checked (0001).
-- Checked before applying: longest existing note is 186 chars; no future dates.

alter table public.tastings
  add constraint tastings_notes_length check (notes is null or char_length(notes) <= 2000),
  -- +1 day of slack: the app's "today" is US Eastern, the DB's is UTC.
  add constraint tastings_tasted_at_not_future check (tasted_at is null or tasted_at <= current_date + 1);
