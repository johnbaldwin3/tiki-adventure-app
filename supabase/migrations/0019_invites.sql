-- Friends & family, step 2c: invite links.
--
-- A member makes a personal invite link (one per person they invite) and
-- sends it themselves. Opening it, the new person gives their name and
-- email; claim_invite() then creates their taster, a household of one and
-- the taster_accounts row (so the 0003 sign-up trigger lets that email in),
-- and connects them to whoever invited them. The app then emails them a
-- sign-in code: the account only exists once they prove they own the email.
--
--  * Links are single-use, expire after 14 days, and the inviter (or an
--    admin) can revoke an unused one.
--  * Until the new person first signs in, the same link can fix a mistyped
--    email (it moves the claim); after that it's spent.
--  * Kill switch and caps live in app_settings (one row): invites_enabled,
--    max_members (everyone with a taster), max_open_invites per member.
--  * Tokens are two random UUIDs (244 random bits), unguessable; invites are only
--    readable by the inviter's household and admins. Signed-out visitors
--    reach them only through invite_preview() / claim_invite().

create table public.app_settings (
  id boolean primary key default true check (id),
  invites_enabled boolean not null default true,
  max_members integer not null default 15 check (max_members between 2 and 500),
  max_open_invites integer not null default 5 check (max_open_invites between 0 and 50),
  updated_at timestamptz not null default now()
);

comment on table public.app_settings is 'App-wide switches (one row): invite kill switch and member caps.';

insert into public.app_settings default values;

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;
grant update (invites_enabled, max_members, max_open_invites, updated_at) on public.app_settings to authenticated;
grant all on public.app_settings to service_role;

create policy "Members read settings" on public.app_settings for select to authenticated
  using ((select public.current_taster_id()) is not null);
create policy "Admins change settings" on public.app_settings for update to authenticated
  using ((select public.current_is_admin())) with check ((select public.current_is_admin()));

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid not null references public.tasters(id) on delete cascade,
  -- Who it's for, as the inviter wrote it ("Sam"), to tell their links apart.
  note text check (note is null or char_length(btrim(note)) between 1 and 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz,
  claimed_by uuid references public.tasters(id) on delete set null,
  claimed_at timestamptz
);

comment on table public.invites is 'Personal, single-use invite links. Claimed via claim_invite().';

create index invites_invited_by_idx on public.invites (invited_by);

alter table public.invites enable row level security;
revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;
grant all on public.invites to service_role;

create policy "See your household's invites, admins see all" on public.invites for select to authenticated
  using (
    (select public.current_is_admin())
    or invited_by in (select t.id from public.tasters t where t.household_id = (select public.current_household_id()))
  );

-- Make a link. Returns the new invite's token.
create function public.create_invite(p_note text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_taster_id();
  s public.app_settings;
  tok text;
begin
  if me is null then raise exception 'Only members can invite people.' using errcode = '42501'; end if;
  select * into s from public.app_settings;
  if not s.invites_enabled then raise exception 'Invites are switched off right now.' using errcode = 'P0001'; end if;
  if (select count(*) from public.tasters) >= s.max_members then
    raise exception 'The app is full for now.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.invites i
      where i.invited_by = me and i.claimed_at is null and i.revoked_at is null and i.expires_at > now()) >= s.max_open_invites then
    raise exception 'You have too many unused invites. Revoke one first.' using errcode = 'P0001';
  end if;
  insert into public.invites (invited_by, note)
  values (me, nullif(btrim(coalesce(p_note, '')), ''))
  returning token into tok;
  return tok;
end;
$$;

-- Revoke an unused link (yours, your household's, or any if admin).
create function public.revoke_invite(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.invites i set revoked_at = now()
  where i.id = p_id and i.claimed_at is null and i.revoked_at is null
    and (public.current_is_admin()
         or i.invited_by in (select t.id from public.tasters t where t.household_id = public.current_household_id()));
  return found;
end;
$$;

-- Has this taster's account ever signed in? (A claim can move until then.)
create function public.taster_has_signed_in(p_taster uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.taster_accounts ta join auth.users u on lower(u.email) = ta.email
    where ta.taster_id = p_taster and u.last_sign_in_at is not null
  )
$$;

-- For the join page: who invited you, or why the link doesn't work.
-- status: ok | used | expired | revoked | closed | unknown
create function public.invite_preview(p_token text)
returns table (status text, inviter text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when i.id is null then 'unknown'
      when i.revoked_at is not null then 'revoked'
      when i.claimed_by is not null and public.taster_has_signed_in(i.claimed_by) then 'used'
      when i.claimed_by is null and i.expires_at <= now() then 'expired'
      when not (select s.invites_enabled from public.app_settings s) then 'closed'
      else 'ok'
    end,
    t.display_name
  from (select 1) one
  left join public.invites i on i.token = p_token
  left join public.tasters t on t.id = i.invited_by
$$;

-- Initials for a new taster: from their name, unique, 2-3 capital letters.
create function public.unique_initials(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  letters text := upper(regexp_replace(p_name, '[^A-Za-z]', '', 'g'));
  words text[] := regexp_split_to_array(upper(btrim(regexp_replace(p_name, '[^A-Za-z ]', '', 'g'))), '\s+');
  base text;
  cand text;
  c text;
begin
  if char_length(letters) = 0 then letters := 'XX'; end if;
  if array_length(words, 1) >= 2 and words[1] <> '' and words[array_length(words, 1)] <> '' then
    base := left(words[1], 1) || left(words[array_length(words, 1)], 1);
  else
    base := rpad(left(letters, 2), 2, 'X');
  end if;
  if not exists (select 1 from public.tasters where initials = base) then return base; end if;
  -- Add a third letter: the next letters of the name first, then A-Z.
  foreach c in array regexp_split_to_array(substr(letters, 2) || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '') loop
    cand := base || c;
    if not exists (select 1 from public.tasters where initials = cand) then return cand; end if;
  end loop;
  raise exception 'No free initials for that name.';
end;
$$;

-- Accept an invite: make the member (or move an unconfirmed claim to a
-- corrected email). Returns 'ok', or the reason it can't.
create function public.claim_invite(p_token text, p_name text, p_email text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv public.invites;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_name, ''));
  existing uuid;
  house uuid;
  newbie uuid;
begin
  if char_length(v_name) not between 1 and 40 then return 'bad_name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return 'bad_email'; end if;

  select * into inv from public.invites where token = p_token for update;
  if inv.id is null then return 'unknown'; end if;
  if inv.revoked_at is not null then return 'revoked'; end if;
  if not (select s.invites_enabled from public.app_settings s) then return 'closed'; end if;

  select ta.taster_id into existing from public.taster_accounts ta where ta.email = v_email;

  if inv.claimed_by is not null then
    if public.taster_has_signed_in(inv.claimed_by) then return 'used'; end if;
    -- Not signed in yet: a corrected email or name moves the claim.
    if existing is not null and existing <> inv.claimed_by then return 'email_taken'; end if;
    update public.taster_accounts set email = v_email where taster_id = inv.claimed_by;
    update public.tasters set display_name = v_name where id = inv.claimed_by;
    return 'ok';
  end if;

  if inv.expires_at <= now() then return 'expired'; end if;
  if existing is not null then return 'email_taken'; end if;
  if (select count(*) from public.tasters) >= (select s.max_members from public.app_settings s) then return 'full'; end if;

  insert into public.households (name) values (v_name) returning id into house;
  insert into public.tasters (initials, display_name, household_id)
  values (public.unique_initials(v_name), v_name, house)
  returning id into newbie;
  insert into public.taster_accounts (taster_id, email) values (newbie, v_email);
  insert into public.connections (taster_a, taster_b)
  values (least(newbie, inv.invited_by), greatest(newbie, inv.invited_by))
  on conflict do nothing;
  update public.invites set claimed_by = newbie, claimed_at = now() where id = inv.id;
  return 'ok';
end;
$$;

revoke execute on function public.create_invite(text), public.revoke_invite(uuid), public.taster_has_signed_in(uuid),
  public.invite_preview(text), public.unique_initials(text), public.claim_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.create_invite(text), public.revoke_invite(uuid) to authenticated, service_role;
-- The join page runs signed out.
grant execute on function public.invite_preview(text), public.claim_invite(text, text, text) to anon, authenticated, service_role;
grant execute on function public.taster_has_signed_in(uuid), public.unique_initials(text) to service_role;
