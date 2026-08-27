alter table public.service_requests
add column review_prompted_at timestamptz;

drop trigger service_requests_guard_transition on public.service_requests;
drop trigger service_requests_record_transition on public.service_requests;

create or replace function private.guard_service_request_transition()
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
    if is_customer
      and old.status = 'completed'
      and old.review_prompted_at is null
      and new.review_prompted_at is not null
      and new.provider_message is not distinct from old.provider_message
      and new.quoted_price is not distinct from old.quoted_price
      and new.scheduled_for is not distinct from old.scheduled_for then
      return new;
    end if;

    raise exception 'Choose a new service request status';
  end if;

  if new.review_prompted_at is distinct from old.review_prompted_at then
    raise exception 'The review prompt can only be acknowledged after completion';
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

create trigger service_requests_guard_transition
before update on public.service_requests
for each row execute function private.guard_service_request_transition();

create trigger service_requests_record_transition
after update of status on public.service_requests
for each row execute function private.record_service_request_transition_event();

grant update (review_prompted_at) on public.service_requests to authenticated;

drop policy "users can review active published listings they do not own" on public.reviews;
drop policy "users can update their own reviews" on public.reviews;

create policy "customers can review completed services"
on public.reviews for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.service_requests
    where service_requests.customer_id = (select auth.uid())
      and service_requests.provider_id = reviews.provider_id
      and service_requests.status = 'completed'
  )
);

create policy "customers can update reviews for completed services"
on public.reviews for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.service_requests
    where service_requests.customer_id = (select auth.uid())
      and service_requests.provider_id = reviews.provider_id
      and service_requests.status = 'completed'
  )
);

create or replace function private.notify_service_request_status()
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
    when 'completed' then 'How was your service?'
    when 'declined' then 'Service request declined'
    when 'cancelled' then 'Service request cancelled'
    else 'Service request updated'
  end;

  notification_body := case
    when new.status = 'completed'
      then new.provider_name || ' marked the job complete. Tap to rate your experience.'
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

revoke all on function private.notify_service_request_status()
from public, anon, authenticated;

comment on column public.service_requests.review_prompted_at is
  'When the customer first saw the post-completion review prompt. The review action remains available afterward.';
