drop function public.transition_service_request(uuid, text, text, numeric, timestamptz);

create function private.guard_service_request_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_customer boolean;
  is_provider boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to update a service request';
  end if;

  is_customer := old.customer_id = current_user_id;
  is_provider := old.provider_owner_id = current_user_id;

  if not is_customer and not is_provider then
    raise exception 'You do not have access to this service request';
  end if;

  if new.status = old.status then
    raise exception 'Choose a new service request status';
  end if;

  if is_customer then
    if not (
      (old.status = 'requested' and new.status = 'cancelled')
      or (old.status = 'quoted' and new.status in ('accepted', 'cancelled'))
      or (old.status in ('accepted', 'scheduled') and new.status = 'cancelled')
    ) then
      raise exception 'Customers cannot make this status change';
    end if;

    if new.provider_message is distinct from old.provider_message
      or new.quoted_price is distinct from old.quoted_price
      or new.scheduled_for is distinct from old.scheduled_for then
      raise exception 'Customers cannot change provider response fields';
    end if;
  else
    if not (
      (old.status = 'requested' and new.status in ('accepted', 'quoted', 'declined'))
      or (old.status = 'quoted' and new.status in ('declined', 'cancelled'))
      or (old.status = 'accepted' and new.status in ('scheduled', 'in_progress', 'cancelled'))
      or (old.status = 'scheduled' and new.status in ('in_progress', 'cancelled'))
      or (old.status = 'in_progress' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Providers cannot make this status change';
    end if;

    if new.status = 'quoted' and (new.quoted_price is null or new.quoted_price <= 0) then
      raise exception 'A positive quoted price is required';
    end if;

    if new.status <> 'quoted' and new.quoted_price is distinct from old.quoted_price then
      raise exception 'The quoted price can only change when sending a quote';
    end if;

    if new.status <> 'scheduled' and new.scheduled_for is distinct from old.scheduled_for then
      raise exception 'The scheduled time can only change when scheduling the service';
    end if;

    new.provider_message := trim(new.provider_message);
  end if;

  return new;
end;
$$;

create function private.record_service_request_transition_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_customer boolean := old.customer_id = current_user_id;
  event_note text;
begin
  event_note := case
    when is_customer and new.status = 'accepted' then 'Customer accepted the quote'
    when is_customer and new.status = 'cancelled' then 'Customer cancelled the request'
    when new.provider_message is distinct from old.provider_message
      and nullif(trim(new.provider_message), '') is not null then trim(new.provider_message)
    when new.status = 'accepted' then 'Provider accepted the request'
    when new.status = 'quoted' then 'Provider sent a quote'
    when new.status = 'scheduled' then 'Provider scheduled the service'
    when new.status = 'in_progress' then 'Provider started the service'
    when new.status = 'completed' then 'Provider completed the service'
    when new.status = 'declined' then 'Provider declined the request'
    else 'Provider cancelled the request'
  end;

  insert into public.service_request_events (
    request_id,
    actor_id,
    from_status,
    to_status,
    note
  ) values (
    new.id,
    current_user_id,
    old.status,
    new.status,
    event_note
  );

  return new;
end;
$$;

revoke all on function private.guard_service_request_transition()
from public, anon, authenticated;

revoke all on function private.record_service_request_transition_event()
from public, anon, authenticated;

create trigger service_requests_guard_transition
before update on public.service_requests
for each row execute function private.guard_service_request_transition();

create trigger service_requests_record_transition
after update on public.service_requests
for each row execute function private.record_service_request_transition_event();

grant update (
  status,
  provider_message,
  quoted_price,
  scheduled_for
) on public.service_requests to authenticated;

create policy "request participants can transition requests"
on public.service_requests for update
to authenticated
using (
  customer_id = (select auth.uid())
  or provider_owner_id = (select auth.uid())
)
with check (
  customer_id = (select auth.uid())
  or provider_owner_id = (select auth.uid())
);
