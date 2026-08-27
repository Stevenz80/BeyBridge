alter table public.user_notifications
  drop constraint if exists user_notifications_kind_check;

alter table public.user_notifications
  add constraint user_notifications_kind_check check (kind in (
    'request_created',
    'request_status',
    'verification_submitted',
    'verification_status',
    'report_status',
    'provider_moderation'
  ));

create table private.platform_admin_email_allowlist (
  email text primary key
    check (
      email = lower(trim(email))
      and char_length(email) between 3 and 320
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  created_at timestamptz not null default now()
);

revoke all on table private.platform_admin_email_allowlist
from public, anon, authenticated, service_role;

insert into private.platform_admin_email_allowlist (email)
values
  ('stevenoueiss10@gmail.com'),
  ('stevenoueiss11@gmail.com')
on conflict (email) do nothing;

create function private.sync_platform_admin_from_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  automatic_note constant text := 'Granted automatically from the BeyBridge administrator email allowlist.';
  old_email text := '';
  new_email text := lower(trim(coalesce(new.email, '')));
begin
  if tg_op = 'UPDATE' then
    old_email := lower(trim(coalesce(old.email, '')));
  end if;

  if tg_op = 'UPDATE' and old_email is distinct from new_email and exists (
      select 1
      from private.platform_admin_email_allowlist as allowed
      where allowed.email = old_email
  ) then
    delete from public.platform_admins
    where user_id = new.id
      and note = automatic_note;
  end if;

  if exists (
    select 1
    from private.platform_admin_email_allowlist as allowed
    where allowed.email = new_email
  ) then
    insert into public.platform_admins (user_id, note)
    values (new.id, automatic_note)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_platform_admin_from_email()
from public, anon, authenticated, service_role;

create trigger auth_users_sync_platform_admin
after insert or update of email on auth.users
for each row execute function private.sync_platform_admin_from_email();

insert into public.platform_admins (user_id, note)
select
  users.id,
  'Granted automatically from the BeyBridge administrator email allowlist.'
from auth.users as users
join private.platform_admin_email_allowlist as allowed
  on allowed.email = lower(trim(coalesce(users.email, '')))
on conflict (user_id) do nothing;

create table public.verification_admin_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  verification_request_id uuid not null unique
    references public.provider_verification_requests (id) on delete cascade,
  state text not null default 'pending'
    check (state in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  provider_message_id text not null default ''
    check (char_length(provider_message_id) <= 200),
  error_message text not null default '' check (char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index verification_admin_email_pending_idx
  on public.verification_admin_email_deliveries (available_at, created_at)
  where state = 'pending';

create trigger verification_admin_email_deliveries_set_updated_at
before update on public.verification_admin_email_deliveries
for each row execute function private.set_updated_at();

create function private.notify_verification_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  )
  select
    admins.user_id,
    'verification_submitted',
    'Provider verification submitted',
    left(new.provider_name || ' submitted evidence for administrator review.', 500),
    '/admin',
    'verification_request',
    new.id::text,
    'submitted'
  from public.platform_admins as admins
  on conflict (user_id, source_type, source_id, source_event) do nothing;

  insert into public.verification_admin_email_deliveries (verification_request_id)
  values (new.id)
  on conflict (verification_request_id) do nothing;

  return new;
end;
$$;

create trigger verification_requests_notify_submitted
after insert on public.provider_verification_requests
for each row execute function private.notify_verification_submitted();

create function public.claim_verification_admin_emails(p_limit integer default 25)
returns table (
  delivery_id uuid,
  verification_request_id uuid,
  provider_owner_id uuid,
  provider_name text,
  owner_email text,
  business_registration text,
  license_number text,
  evidence_summary text,
  submitted_at timestamptz,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception 'Verification email batch size must be between 1 and 100';
  end if;

  update public.verification_admin_email_deliveries
  set
    state = case when attempts >= 5 then 'failed' else 'pending' end,
    available_at = now(),
    error_message = case
      when attempts >= 5 then 'The email worker did not finish this item after repeated claims.'
      else error_message
    end
  where state = 'sending'
    and updated_at < now() - interval '5 minutes';

  return query
  with candidates as (
    select deliveries.id
    from public.verification_admin_email_deliveries as deliveries
    join public.provider_verification_requests as requests
      on requests.id = deliveries.verification_request_id
    where deliveries.state = 'pending'
      and deliveries.available_at <= now()
      and deliveries.attempts < 5
      and requests.status = 'pending'
    order by deliveries.available_at, deliveries.created_at
    for update of deliveries skip locked
    limit p_limit
  ), claimed as (
    update public.verification_admin_email_deliveries as deliveries
    set
      state = 'sending',
      attempts = deliveries.attempts + 1,
      error_message = ''
    from candidates
    where deliveries.id = candidates.id
    returning deliveries.*
  )
  select
    claimed.id,
    requests.id,
    requests.provider_owner_id,
    requests.provider_name,
    coalesce(users.email, '')::text,
    requests.business_registration,
    requests.license_number,
    requests.evidence_summary,
    requests.submitted_at,
    claimed.attempts
  from claimed
  join public.provider_verification_requests as requests
    on requests.id = claimed.verification_request_id
  left join auth.users as users on users.id = requests.provider_owner_id;
end;
$$;

revoke all on table public.verification_admin_email_deliveries
from public, anon, authenticated, service_role;
grant select, insert, update, delete
on public.verification_admin_email_deliveries to service_role;

alter table public.verification_admin_email_deliveries enable row level security;

revoke all on function private.notify_verification_submitted()
from public, anon, authenticated, service_role;

revoke all on function public.claim_verification_admin_emails(integer)
from public, anon, authenticated;
grant execute on function public.claim_verification_admin_emails(integer)
to service_role;

insert into public.user_notifications (
  user_id,
  kind,
  title,
  body,
  route,
  source_type,
  source_id,
  source_event
)
select
  admins.user_id,
  'verification_submitted',
  'Provider verification submitted',
  left(requests.provider_name || ' submitted evidence for administrator review.', 500),
  '/admin',
  'verification_request',
  requests.id::text,
  'submitted'
from public.platform_admins as admins
cross join public.provider_verification_requests as requests
where requests.status = 'pending'
on conflict (user_id, source_type, source_id, source_event) do nothing;

insert into public.verification_admin_email_deliveries (verification_request_id)
select requests.id
from public.provider_verification_requests as requests
where requests.status = 'pending'
on conflict (verification_request_id) do nothing;

comment on table private.platform_admin_email_allowlist is
  'Trusted email allowlist used to assign BeyBridge platform administrators.';

comment on table public.verification_admin_email_deliveries is
  'Server-only outbox for provider verification emails sent to the BeyBridge administrator.';

comment on function public.claim_verification_admin_emails(integer) is
  'Claims verification email deliveries for the trusted notification worker.';
