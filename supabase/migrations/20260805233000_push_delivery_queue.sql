create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.user_notifications (id) on delete cascade,
  push_token_id uuid not null references public.push_tokens (id) on delete cascade,
  state text not null default 'pending' check (state in (
    'pending',
    'sending',
    'ticketed',
    'delivered',
    'failed',
    'cancelled'
  )),
  expo_ticket_id text,
  attempts integer not null default 0 check (attempts between 0 and 10),
  receipt_attempts integer not null default 0 check (receipt_attempts between 0 and 10),
  available_at timestamptz not null default now(),
  next_receipt_check_at timestamptz,
  sent_at timestamptz,
  checked_at timestamptz,
  error_code text not null default '' check (char_length(error_code) <= 80),
  error_message text not null default '' check (char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, push_token_id)
);

create index push_deliveries_pending_idx
  on public.push_deliveries (available_at, created_at)
  where state = 'pending';

create index push_deliveries_receipts_idx
  on public.push_deliveries (next_receipt_check_at, sent_at)
  where state = 'ticketed';

create index push_deliveries_notification_idx
  on public.push_deliveries (notification_id, created_at desc);

create trigger push_deliveries_set_updated_at
before update on public.push_deliveries
for each row execute function private.set_updated_at();

create function private.queue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.push_deliveries (notification_id, push_token_id)
  select new.id, tokens.id
  from public.push_tokens as tokens
  where tokens.user_id = new.user_id
    and tokens.enabled
  on conflict (notification_id, push_token_id) do nothing;

  return new;
end;
$$;

create trigger user_notifications_queue_push
after insert on public.user_notifications
for each row execute function private.queue_notification_push();

create function public.claim_push_deliveries(p_limit integer default 100)
returns table (
  delivery_id uuid,
  push_token_id uuid,
  expo_push_token text,
  title text,
  body text,
  route text,
  notification_id uuid,
  attempt_number integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception 'Push delivery batch size must be between 1 and 100';
  end if;

  update public.push_deliveries
  set
    state = case when attempts >= 5 then 'failed' else 'pending' end,
    available_at = now(),
    error_code = case when attempts >= 5 then 'WorkerTimeout' else error_code end,
    error_message = case
      when attempts >= 5 then 'The delivery worker did not finish this item after repeated claims.'
      else error_message
    end
  where state = 'sending'
    and updated_at < now() - interval '5 minutes';

  return query
  with candidates as (
    select deliveries.id
    from public.push_deliveries as deliveries
    join public.push_tokens as tokens on tokens.id = deliveries.push_token_id
    where deliveries.state = 'pending'
      and deliveries.available_at <= now()
      and deliveries.attempts < 5
      and tokens.enabled
    order by deliveries.available_at, deliveries.created_at
    for update of deliveries skip locked
    limit p_limit
  ), claimed as (
    update public.push_deliveries as deliveries
    set
      state = 'sending',
      attempts = deliveries.attempts + 1,
      error_code = '',
      error_message = ''
    from candidates
    where deliveries.id = candidates.id
    returning deliveries.*
  )
  select
    claimed.id,
    claimed.push_token_id,
    tokens.expo_push_token,
    notifications.title,
    notifications.body,
    notifications.route,
    notifications.id,
    claimed.attempts
  from claimed
  join public.push_tokens as tokens on tokens.id = claimed.push_token_id
  join public.user_notifications as notifications on notifications.id = claimed.notification_id;
end;
$$;

revoke all on table public.push_deliveries
from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.push_deliveries to service_role;

alter table public.push_deliveries enable row level security;

revoke all on function private.queue_notification_push()
from public, anon, authenticated;

revoke all on function public.claim_push_deliveries(integer)
from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;

comment on table public.push_deliveries is
  'Server-only Expo Push Service outbox with ticket, receipt, and retry state.';

comment on function public.claim_push_deliveries(integer) is
  'Claims an idempotent batch for the trusted push worker. Not callable by app users.';
