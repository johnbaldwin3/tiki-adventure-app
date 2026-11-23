-- Smuggler's Cove rum categories for the bottles in our bar.
-- Each rum's category is worked out in the app from the book's list
-- (src/data/smugglers-cove.ts) when the bottle is in it; for a bottle that
-- isn't, the tasters can save the category the recipe helper suggested
-- (from a photo or the name) here. Null = not labelled (the app falls back
-- to the book, then to the style's closest category).

alter table public.cabinet_items
  add column rum_category text check (rum_category is null or rum_category in (
    'pot-still-unaged',
    'pot-still-lightly-aged',
    'pot-still-aged',
    'pot-still-long-aged',
    'blended-lightly-aged',
    'blended-aged',
    'blended-long-aged',
    'column-still-lightly-aged',
    'column-still-aged',
    'column-still-long-aged',
    'black-pot-still',
    'black-blended',
    'black-blended-overproof',
    'cane-coffey-still-aged',
    'cane-pot-still-unaged',
    'cane-pot-still-aged',
    'agricole-blanc',
    'agricole-vieux',
    'agricole-long-aged',
    'cachaca-unaged',
    'cachaca-aged'
  ));

-- Where that label came from: the book's list ('book'), the rum checker's
-- best guess ('ai'), or our own pick ('ours'). Set together with rum_category.
alter table public.cabinet_items
  add column rum_category_basis text check (rum_category_basis is null or rum_category_basis in ('book', 'ai', 'ours')),
  add constraint cabinet_items_rum_label_pair check ((rum_category is null) = (rum_category_basis is null));

comment on column public.cabinet_items.rum_category is 'Smuggler''s Cove rum category id (src/data/smugglers-cove.ts) we labelled this bottle with, or null.';
