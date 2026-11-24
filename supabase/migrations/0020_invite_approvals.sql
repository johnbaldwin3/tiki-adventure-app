-- Invites need an admin's OK (builds on 0019).
--
-- Any member can still make an invite link, but one made by someone who
-- isn't an admin waits for John or Genny to approve it before it works.
-- Admins' own links work straight away.
--
--  * invites.approved_at / approved_by: null while waiting. Existing links
--    count as approved (they were made before this rule).
--  * The inviter doesn't see the link until it's approved, so the invitee
--    never meets a waiting link; if they somehow do, invite_preview() and
--    claim_invite() answer 'pending' and nothing is created.
--  * Approving restarts the 14 days, so a slow approval doesn't eat into
--    the time the friend has to join. Declining cancels the link
--    (revoked_at) and marks it declined_at, so the inviter sees why.
--  * pending_invites() lists the waiting links for admins (with the
--    inviter's name, which admins can't otherwise read for people outside
--    their friends). admin_alert_emails() gives the app the admins' emails
--    for the "an invite is waiting" email: only to the inviter, only for
--    their own waiting link, and only once per link.

alter table public.invites
  add column approved_at timestamptz,
  add column approved_by uuid references public.tasters(id) on delete set null,
  add column declined_at timestamptz,
  add column admins_alerted_at timestamptz;

comment on column public.invites.approved_at is 'When an admin approved the link (or when an admin made it). Null: waiting, the link does not work yet.';
comment on column public.invites.declined_at is 'An admin said no. revoked_at is set at the same time.';
comment on column public.invites.admins_alerted_at is 'When the admins were emailed that this link is waiting (once per link).';

update public.invites set approved_at = created_at where approved_at is null;

create index invites_waiting_idx on public.invites (created_at)
  where approved_at is null and revoked_at is null and claimed_at is null;

-- Make a link. Admins' links are approved at once; others wait.
create or replace function public.create_invite(p_note text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := public.current_taster_id();
  admin boolean := public.current_is_admin();
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
  insert into public.invites (invited_by, note, approved_at, approved_by)
  values (me, nullif(btrim(coalesce(p_note, '')), ''),
          case when admin then now() end, case when admin then me end)
  returning token into tok;
  return tok;
end;
$$;

-- For the join page: who invited you, or why the link doesn't work.
-- status: ok | used | expired | revoked | closed | pending | unknown
create or replace function public.invite_preview(p_token text)
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
      when i.approved_at is null then 'pending'
      when not (select s.invites_enabled from public.app_settings s) then 'closed'
      else 'ok'
    end,
    t.display_name
  from (select 1) one
  left join public.invites i on i.token = p_token
  left join public.tasters t on t.id = i.invited_by
$$;

-- Accept an invite (as in 0019), but not while it waits for approval.
create or replace function public.claim_invite(p_token text, p_name text, p_email text)
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
  if inv.approved_at is null then return 'pending'; end if;
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

-- Admins: the links waiting for an OK, oldest first. Empty for everyone else.
create function public.pending_invites()
returns table (id uuid, note text, inviter text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.note, t.display_name, i.created_at
  from public.invites i
  join public.tasters t on t.id = i.invited_by
  where public.current_is_admin()
    and i.approved_at is null and i.revoked_at is null and i.claimed_at is null and i.expires_at > now()
  order by i.created_at
$$;

-- Admins: approve a waiting link (and restart its 14 days). Returns who to
-- tell (the inviter's email and name, and the link's note), or no row if
-- there was nothing to approve.
create function public.approve_invite(p_id uuid)
returns table (inviter_email text, inviter_name text, note text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv public.invites;
begin
  if not public.current_is_admin() then return; end if;
  update public.invites i
  set approved_at = now(), approved_by = public.current_taster_id(), expires_at = now() + interval '14 days'
  where i.id = p_id and i.approved_at is null and i.revoked_at is null and i.claimed_at is null and i.expires_at > now()
  returning * into inv;
  if inv.id is null then return; end if;
  return query
    select (select ta.email from public.taster_accounts ta where ta.taster_id = inv.invited_by order by ta.email limit 1),
           t.display_name, inv.note
    from public.tasters t where t.id = inv.invited_by;
end;
$$;

-- Admins: say no to a waiting link. The inviter sees "Not approved".
create function public.decline_invite(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.current_is_admin() then return false; end if;
  update public.invites i set revoked_at = now(), declined_at = now()
  where i.id = p_id and i.approved_at is null and i.revoked_at is null and i.claimed_at is null;
  return found;
end;
$$;

-- The inviter, right after making a waiting link: the admins' emails, to
-- tell them it's waiting. Once per link; empty otherwise.
create function public.admin_alert_emails(p_token text)
returns setof text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  inv_id uuid;
begin
  update public.invites i set admins_alerted_at = now()
  where i.token = p_token and i.invited_by = public.current_taster_id()
    and i.approved_at is null and i.revoked_at is null and i.admins_alerted_at is null
  returning i.id into inv_id;
  if inv_id is null then return; end if;
  return query
    select distinct ta.email from public.taster_accounts ta
    join public.tasters t on t.id = ta.taster_id
    where t.is_admin;
end;
$$;

revoke execute on function public.pending_invites(), public.approve_invite(uuid), public.decline_invite(uuid),
  public.admin_alert_emails(text) from public, anon, authenticated;
grant execute on function public.pending_invites(), public.approve_invite(uuid), public.decline_invite(uuid),
  public.admin_alert_emails(text) to authenticated, service_role;
-- Replaced functions keep their 0019 grants; restated for a fresh project.
grant execute on function public.create_invite(text) to authenticated, service_role;
grant execute on function public.invite_preview(text), public.claim_invite(text, text, text) to anon, authenticated, service_role;
