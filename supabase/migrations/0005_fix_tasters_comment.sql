-- Documentation only: 0001's comment predicted tasters would become
-- auth.users rows. What was built (0003) links sign-in emails to tasters via
-- the private taster_accounts table instead.
comment on table public.tasters is 'People who taste and rate cocktails (JB, GM). Sign-in accounts are linked by email through taster_accounts (migration 0003).';
