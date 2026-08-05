create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'request_created',
    'request_status',
    'verification_status',
    'report_status',
    'provider_moderation'
  )),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500),
  route text not null default '' check (char_length(route) <= 300),
  source_type text not null check (source_type in (
    'service_request',
    'verification_request',
    'report',
    'provider'
  )),
  source_id text not null check (char_length(source_id) between 1 and 100),
  source_event text not null check (char_length(source_event) between 1 and 80),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, source_event)
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null unique
    check (char_length(expo_push_token) between 20 and 512),
  platform text not null check (platform in ('android', 'ios')),
  device_name text not null default '' check (char_length(device_name) <= 120),
  app_version text not null default '' check (char_length(app_version) <= 50),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index user_notifications_user_unread_idx
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

create index push_tokens_user_enabled_idx
  on public.push_tokens (user_id, updated_at desc)
  where enabled;

create function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default '',
  p_app_version text default ''
)
returns public.push_tokens
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  clean_token text := trim(p_expo_push_token);
  registered_token public.push_tokens;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to register notifications';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'Push notifications are only available on Android and iOS';
  end if;

  if char_length(clean_token) not between 20 and 512
    or clean_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Invalid Expo push token';
  end if;

  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_name,
    app_version,
    enabled
  ) values (
    current_user_id,
    clean_token,
    p_platform,
    left(coalesce(trim(p_device_name), ''), 120),
    left(coalesce(trim(p_app_version), ''), 50),
    true
  )
  on conflict (expo_push_token) do update
  set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    enabled = true,
    updated_at = now()
  returning * into registered_token;

  return registered_token;
end;
$$;

create function public.unregister_push_token(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required to unregister notifications';
  end if;

  delete from public.push_tokens
  where user_id = current_user_id
    and expo_push_token = trim(p_expo_push_token);
end;
$$;

create function private.notify_service_request_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider_owner_id is null then
    return new;
  end if;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  ) values (
    new.provider_owner_id,
    'request_created',
    'New request from ' || new.customer_name,
    left(new.description, 500),
    '/request/' || new.id::text,
    'service_request',
    new.id::text,
    'requested'
  )
  on conflict (user_id, source_type, source_id, source_event) do nothing;

  return new;
end;
$$;

create function private.notify_service_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  recipient_id uuid;
  notification_title text;
  notification_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  recipient_id := case
    when actor_id = new.customer_id then new.provider_owner_id
    else new.customer_id
  end;

  if recipient_id is null then
    return new;
  end if;

  notification_title := case new.status
    when 'quoted' then 'New quote from ' || new.provider_name
    when 'accepted' then 'Service request accepted'
    when 'scheduled' then 'Service visit scheduled'
    when 'in_progress' then 'Service is in progress'
    when 'completed' then 'Service marked complete'
    when 'declined' then 'Service request declined'
    when 'cancelled' then 'Service request cancelled'
    else 'Service request updated'
  end;

  notification_body := case
    when new.status = 'quoted' and new.quoted_price is not null
      then new.provider_name || ' sent a quote for ' || new.quoted_price::text || ' ' || new.budget_currency || '.'
    when new.status = 'scheduled' and new.scheduled_for is not null
      then new.provider_name || ' scheduled the service. Open the request for details.'
    when nullif(trim(new.provider_message), '') is not null
      then left(trim(new.provider_message), 500)
    when actor_id = new.customer_id
      then new.customer_name || ' updated the request to ' || replace(new.status, '_', ' ') || '.'
    else new.provider_name || ' updated the request to ' || replace(new.status, '_', ' ') || '.'
  end;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  ) values (
    recipient_id,
    'request_status',
    notification_title,
    left(notification_body, 500),
    '/request/' || new.id::text,
    'service_request',
    new.id::text,
    new.status
  )
  on conflict (user_id, source_type, source_id, source_event) do nothing;

  return new;
end;
$$;

create function private.notify_verification_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status
    or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  ) values (
    new.provider_owner_id,
    'verification_status',
    case when new.status = 'approved'
      then 'Your business is verified'
      else 'Verification needs attention'
    end,
    case when nullif(trim(new.admin_note), '') is not null
      then left(trim(new.admin_note), 500)
      when new.status = 'approved'
        then new.provider_name || ' now displays the verified badge.'
      else 'Review the decision and submit updated evidence when you are ready.'
    end,
    '/provider/verification',
    'verification_request',
    new.id::text,
    new.status
  )
  on conflict (user_id, source_type, source_id, source_event) do nothing;

  return new;
end;
$$;

create function private.notify_report_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status or new.status = 'open' then
    return new;
  end if;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  ) values (
    new.reporter_id,
    'report_status',
    case new.status
      when 'reviewing' then 'Your report is being reviewed'
      when 'resolved' then 'Your report was resolved'
      else 'Your report was closed'
    end,
    case when nullif(trim(new.admin_note), '') is not null
      then left(trim(new.admin_note), 500)
      else 'BeyBridge updated your report about ' || new.target_name || '.'
    end,
    '/notifications',
    'report',
    new.id::text,
    new.status
  )
  on conflict (user_id, source_type, source_id, source_event) do nothing;

  return new;
end;
$$;

create function private.notify_provider_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_owner_id uuid;
  listing_name text;
begin
  select providers.owner_id, providers.name
    into listing_owner_id, listing_name
    from public.providers
    where providers.id = new.provider_id;

  if listing_owner_id is null then
    return new;
  end if;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    body,
    route,
    source_type,
    source_id,
    source_event
  ) values (
    listing_owner_id,
    'provider_moderation',
    case when new.action = 'suspend'
      then 'Your listing was paused'
      else 'Your listing was restored'
    end,
    left(new.reason, 500),
    '/business',
    'provider',
    new.provider_id,
    new.action || ':' || new.id::text
  )
  on conflict (user_id, source_type, source_id, source_event) do nothing;

  return new;
end;
$$;

create trigger service_requests_notify_created
after insert on public.service_requests
for each row execute function private.notify_service_request_created();

create trigger service_requests_notify_status
after update of status on public.service_requests
for each row execute function private.notify_service_request_status();

create trigger verification_requests_notify_status
after update of status on public.provider_verification_requests
for each row execute function private.notify_verification_status();

create trigger reports_notify_status
after update of status on public.reports
for each row execute function private.notify_report_status();

create trigger moderation_actions_notify_provider
after insert on public.provider_moderation_actions
for each row execute function private.notify_provider_moderation();

revoke all on function public.register_push_token(text, text, text, text)
from public, anon;
grant execute on function public.register_push_token(text, text, text, text)
to authenticated;

revoke all on function public.unregister_push_token(text)
from public, anon;
grant execute on function public.unregister_push_token(text)
to authenticated;

revoke all on function private.notify_service_request_created()
from public, anon, authenticated;
revoke all on function private.notify_service_request_status()
from public, anon, authenticated;
revoke all on function private.notify_verification_status()
from public, anon, authenticated;
revoke all on function private.notify_report_status()
from public, anon, authenticated;
revoke all on function private.notify_provider_moderation()
from public, anon, authenticated;

revoke all on table public.user_notifications, public.push_tokens
from anon, authenticated, service_role;

grant select, delete on public.user_notifications to authenticated;
grant update (read_at) on public.user_notifications to authenticated;
grant select, insert, update, delete on public.user_notifications, public.push_tokens
to service_role;

alter table public.user_notifications enable row level security;
alter table public.push_tokens enable row level security;

create policy "users can read their own notifications"
on public.user_notifications for select
to authenticated
using (user_id = (select auth.uid()));

create policy "users can mark their own notifications read"
on public.user_notifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "users can delete their own notifications"
on public.user_notifications for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "users can read their own push registrations"
on public.push_tokens for select
to authenticated
using (user_id = (select auth.uid()));

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;
end;
$$;

comment on table public.user_notifications is
  'Per-account activity feed generated from marketplace workflow changes.';

comment on table public.push_tokens is
  'Authenticated Expo push-token registrations. Direct client writes are blocked; use the RPCs.';
