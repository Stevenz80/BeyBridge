create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.providers (id) on delete restrict,
  provider_owner_id uuid references auth.users (id) on delete set null,
  customer_id uuid not null references auth.users (id) on delete cascade,
  provider_name text not null,
  customer_name text not null,
  customer_phone text not null default '',
  description text not null
    check (char_length(trim(description)) between 20 and 2000),
  service_address text not null
    check (char_length(trim(service_address)) between 2 and 300),
  preferred_schedule text not null default ''
    check (char_length(preferred_schedule) <= 200),
  urgency text not null default 'standard'
    check (urgency in ('standard', 'urgent', 'emergency')),
  budget_amount numeric(12, 2)
    check (budget_amount is null or budget_amount > 0),
  budget_currency text not null default 'USD'
    check (budget_currency in ('USD', 'LBP')),
  status text not null default 'requested'
    check (status in (
      'requested',
      'quoted',
      'accepted',
      'scheduled',
      'in_progress',
      'completed',
      'declined',
      'cancelled'
    )),
  provider_message text not null default ''
    check (char_length(provider_message) <= 1000),
  quoted_price numeric(12, 2)
    check (quoted_price is null or quoted_price > 0),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider_owner_id is null or customer_id <> provider_owner_id)
);

create table public.service_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  from_status text,
  to_status text not null,
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  check (
    from_status is null
    or from_status in (
      'requested',
      'quoted',
      'accepted',
      'scheduled',
      'in_progress',
      'completed',
      'declined',
      'cancelled'
    )
  ),
  check (to_status in (
    'requested',
    'quoted',
    'accepted',
    'scheduled',
    'in_progress',
    'completed',
    'declined',
    'cancelled'
  ))
);

create index service_requests_customer_created_idx
  on public.service_requests (customer_id, created_at desc);

create index service_requests_provider_owner_created_idx
  on public.service_requests (provider_owner_id, created_at desc)
  where provider_owner_id is not null;

create index service_requests_provider_id_idx
  on public.service_requests (provider_id);

create index service_requests_provider_open_idx
  on public.service_requests (provider_owner_id, updated_at desc)
  where status in ('requested', 'quoted', 'accepted', 'scheduled', 'in_progress');

create index service_request_events_request_created_idx
  on public.service_request_events (request_id, created_at);

create index service_request_events_actor_id_idx
  on public.service_request_events (actor_id)
  where actor_id is not null;

create function private.prepare_service_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing_owner_id uuid;
  listing_name text;
  listing_status text;
  profile_name text;
  profile_phone text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to request a service';
  end if;

  select providers.owner_id, providers.name, providers.listing_status
    into listing_owner_id, listing_name, listing_status
    from public.providers
    where providers.id = new.provider_id;

  if listing_owner_id is null or listing_status <> 'published' then
    raise exception 'This provider is not accepting requests';
  end if;

  if listing_owner_id = current_user_id then
    raise exception 'You cannot request your own service';
  end if;

  select profiles.full_name, profiles.phone
    into profile_name, profile_phone
    from public.profiles
    where profiles.id = current_user_id;

  new.customer_id := current_user_id;
  new.provider_owner_id := listing_owner_id;
  new.provider_name := listing_name;
  new.customer_name := coalesce(nullif(trim(profile_name), ''), 'BeyBridge customer');
  new.customer_phone := coalesce(trim(profile_phone), '');
  new.status := 'requested';
  new.provider_message := '';
  new.quoted_price := null;
  new.scheduled_for := null;
  return new;
end;
$$;

create function private.record_initial_service_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.service_request_events (
    request_id,
    actor_id,
    from_status,
    to_status,
    note
  ) values (
    new.id,
    new.customer_id,
    null,
    'requested',
    'Customer sent a service request'
  );
  return new;
end;
$$;

revoke all on function private.prepare_service_request() from public, anon, authenticated;
revoke all on function private.record_initial_service_request_event() from public, anon, authenticated;

create trigger service_requests_prepare_insert
before insert on public.service_requests
for each row execute function private.prepare_service_request();

create trigger service_requests_set_updated_at
before update on public.service_requests
for each row execute function private.set_updated_at();

create trigger service_requests_record_initial_event
after insert on public.service_requests
for each row execute function private.record_initial_service_request_event();

create function public.transition_service_request(
  p_request_id uuid,
  p_next_status text,
  p_provider_message text default null,
  p_quoted_price numeric default null,
  p_scheduled_for timestamptz default null
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_request public.service_requests;
  previous_status text;
  is_customer boolean;
  is_provider boolean;
  event_note text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to update a service request';
  end if;

  select service_requests.*
    into current_request
    from public.service_requests
    where service_requests.id = p_request_id
    for update;

  if current_request.id is null then
    raise exception 'Service request not found';
  end if;

  is_customer := current_request.customer_id = current_user_id;
  is_provider := current_request.provider_owner_id = current_user_id;

  if not is_customer and not is_provider then
    raise exception 'You do not have access to this service request';
  end if;

  if p_next_status not in (
    'quoted',
    'accepted',
    'scheduled',
    'in_progress',
    'completed',
    'declined',
    'cancelled'
  ) then
    raise exception 'Unsupported service request status';
  end if;

  if is_customer then
    if not (
      (current_request.status = 'requested' and p_next_status = 'cancelled')
      or (current_request.status = 'quoted' and p_next_status in ('accepted', 'cancelled'))
      or (current_request.status in ('accepted', 'scheduled') and p_next_status = 'cancelled')
    ) then
      raise exception 'Customers cannot make this status change';
    end if;
  else
    if not (
      (current_request.status = 'requested' and p_next_status in ('accepted', 'quoted', 'declined'))
      or (current_request.status = 'quoted' and p_next_status in ('declined', 'cancelled'))
      or (current_request.status = 'accepted' and p_next_status in ('scheduled', 'in_progress', 'cancelled'))
      or (current_request.status = 'scheduled' and p_next_status in ('in_progress', 'cancelled'))
      or (current_request.status = 'in_progress' and p_next_status in ('completed', 'cancelled'))
    ) then
      raise exception 'Providers cannot make this status change';
    end if;
  end if;

  if p_next_status = 'quoted' and (p_quoted_price is null or p_quoted_price <= 0) then
    raise exception 'A positive quoted price is required';
  end if;

  previous_status := current_request.status;

  event_note := case
    when is_customer and p_next_status = 'accepted' then 'Customer accepted the quote'
    when is_customer and p_next_status = 'cancelled' then 'Customer cancelled the request'
    when nullif(trim(coalesce(p_provider_message, '')), '') is not null
      then trim(p_provider_message)
    when p_next_status = 'accepted' then 'Provider accepted the request'
    when p_next_status = 'quoted' then 'Provider sent a quote'
    when p_next_status = 'scheduled' then 'Provider scheduled the service'
    when p_next_status = 'in_progress' then 'Provider started the service'
    when p_next_status = 'completed' then 'Provider completed the service'
    when p_next_status = 'declined' then 'Provider declined the request'
    else 'Provider cancelled the request'
  end;

  update public.service_requests
  set
    status = p_next_status,
    provider_message = case
      when is_provider and p_provider_message is not null then trim(p_provider_message)
      else current_request.provider_message
    end,
    quoted_price = case
      when p_next_status = 'quoted' then p_quoted_price
      else current_request.quoted_price
    end,
    scheduled_for = case
      when p_next_status = 'scheduled' then p_scheduled_for
      else current_request.scheduled_for
    end
  where id = current_request.id
  returning * into current_request;

  insert into public.service_request_events (
    request_id,
    actor_id,
    from_status,
    to_status,
    note
  ) values (
    current_request.id,
    current_user_id,
    previous_status,
    p_next_status,
    event_note
  );

  return current_request;
end;
$$;

revoke all on function public.transition_service_request(uuid, text, text, numeric, timestamptz)
from public, anon;
grant execute on function public.transition_service_request(uuid, text, text, numeric, timestamptz)
to authenticated;

revoke all on table public.service_requests, public.service_request_events
from anon, authenticated, service_role;

grant select on public.service_requests, public.service_request_events to authenticated;

grant insert (
  provider_id,
  description,
  service_address,
  preferred_schedule,
  urgency,
  budget_amount,
  budget_currency
) on public.service_requests to authenticated;

grant select, insert, update, delete on
  public.service_requests,
  public.service_request_events
to service_role;

alter table public.service_requests enable row level security;
alter table public.service_request_events enable row level security;

create policy "request participants can read requests"
on public.service_requests for select
to authenticated
using (
  customer_id = (select auth.uid())
  or provider_owner_id = (select auth.uid())
);

create policy "customers can create requests for published providers"
on public.service_requests for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and provider_owner_id is not null
  and provider_owner_id <> (select auth.uid())
  and exists (
    select 1
    from public.providers
    where providers.id = provider_id
      and providers.owner_id = provider_owner_id
      and providers.listing_status = 'published'
  )
);

create policy "request participants can read request events"
on public.service_request_events for select
to authenticated
using (
  exists (
    select 1
    from public.service_requests
    where service_requests.id = request_id
      and (
        service_requests.customer_id = (select auth.uid())
        or service_requests.provider_owner_id = (select auth.uid())
      )
  )
);

comment on table public.service_requests is
  'Customer-to-provider service requests with a database-enforced status workflow.';

comment on table public.service_request_events is
  'Append-only audit timeline for service request status transitions.';
