-- Phase 7: sign-in for registered tasters (JB, GM) and write access to
-- their OWN tastings, enforced by RLS.
--
-- Design notes:
--  * Accounts are Supabase Auth email + password users. Which emails belong
--    to which taster lives in taster_accounts -- a table with RLS on and NO
--    policies, so neither anon nor signed-in clients can read it (emails
--    aren't exposed through the public API). It's only consulted by the
--    SECURITY DEFINER functions below.
--  * Keep "Confirm email" ON in Supabase Auth: it is what proves a new
--    account really belongs to the listed email.
--  * Sign-ups are limited to those emails by a trigger on auth.users, so a
--    stranger can't create an account at all (the app also shows a friendly
--    message). Email confirmation (Supabase's default) proves the person
--    owns the address before they can sign in.
--  * The taster emails themselves are NOT in this file (keeps personal data
--    out of git). Add/change them with:
--      insert into public.taster_accounts (taster_id, email)
--      select id, 'someone@example.com' from public.tasters where initials = 'GM';
--  * Tastings stay publicly readable; insert/update are allowed only when
--    taster_id is the signed-in person's own taster. No delete policy.

create table public.taster_accounts (
  taster_id uuid primary key references public.tasters(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email)) and email like '%@%'),
  created_at timestamptz not null default now()
);

comment on table public.taster_accounts is 'Which sign-in email belongs to which taster. RLS on with no policies: readable only via SECURITY DEFINER functions.';

alter table public.taster_accounts enable row level security;
revoke all on public.taster_accounts from anon, authenticated;

-- The signed-in user's taster id (null if not signed in or not a taster).
-- Callable by signed-in users on purpose (the app asks "which taster am I?"
-- via /rest/v1/rpc/current_taster_id); it only ever returns the caller's own
-- id, so the Supabase advisor's SECURITY DEFINER warning is accepted here.
-- Verified after applying: JB can update all 21 of his rows and 0 of GM's;
-- anon can update nothing and can't read taster_accounts.
create function public.current_taster_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ta.taster_id
  from public.taster_accounts ta
  where ta.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
$$;

revoke execute on function public.current_taster_id() from public, anon;
grant execute on function public.current_taster_id() to authenticated;

-- Only registered taster emails may sign up.
create function public.enforce_taster_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.taster_accounts ta where ta.email = lower(btrim(new.email))
  ) then
    raise exception 'Sign-ups are limited to registered tasters.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_taster_signup() from public, anon, authenticated;

create trigger enforce_taster_signup
before insert on auth.users
for each row execute function public.enforce_taster_signup();

-- Write access to your own tastings only.
create policy "Tasters can add their own tastings"
on public.tastings for insert
to authenticated
with check (taster_id = (select public.current_taster_id()));

create policy "Tasters can update their own tastings"
on public.tastings for update
to authenticated
using (taster_id = (select public.current_taster_id()))
with check (taster_id = (select public.current_taster_id()));
