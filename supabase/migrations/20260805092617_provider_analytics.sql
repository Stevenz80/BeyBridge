create index service_request_events_request_actor_created_idx
  on public.service_request_events (request_id, actor_id, created_at)
  where actor_id is not null;

create function public.get_provider_analytics(p_window_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  window_days integer := least(greatest(coalesce(p_window_days, 30), 7), 365);
  result jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to view provider analytics';
  end if;

  with scoped_requests as materialized (
    select
      service_requests.id,
      service_requests.provider_id,
      service_requests.status,
      service_requests.quoted_price,
      service_requests.budget_currency,
      service_requests.created_at,
      response.first_response_at
    from public.service_requests
    left join lateral (
      select min(service_request_events.created_at) as first_response_at
      from public.service_request_events
      where service_request_events.request_id = service_requests.id
        and service_request_events.actor_id = current_user_id
        and service_request_events.from_status is not null
    ) response on true
    where service_requests.provider_owner_id = current_user_id
      and service_requests.created_at >= now() - make_interval(days => window_days)
  ),
  totals as (
    select
      count(*)::integer as total_requests,
      count(*) filter (where status = 'requested')::integer as new_requests,
      count(*) filter (
        where status in ('quoted', 'accepted', 'scheduled', 'in_progress')
      )::integer as active_requests,
      count(*) filter (where status = 'completed')::integer as completed_requests,
      count(first_response_at)::integer as responded_requests,
      round(
        avg(extract(epoch from (first_response_at - created_at)) / 60.0)::numeric,
        1
      ) as average_response_minutes,
      coalesce(sum(quoted_price) filter (
        where status = 'completed' and budget_currency = 'USD'
      ), 0)::numeric as completed_value_usd,
      coalesce(sum(quoted_price) filter (
        where status = 'completed' and budget_currency = 'LBP'
      ), 0)::numeric as completed_value_lbp
    from scoped_requests
  ),
  quote_totals as (
    select
      count(*) filter (
        where service_request_events.to_status = 'quoted'
          and service_request_events.actor_id = current_user_id
      )::integer as quotes_sent,
      count(*) filter (
        where service_request_events.from_status = 'quoted'
          and service_request_events.to_status = 'accepted'
      )::integer as quotes_accepted
    from public.service_request_events
    inner join scoped_requests
      on scoped_requests.id = service_request_events.request_id
  ),
  listing_totals as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'provider_id', listing_performance.provider_id,
          'provider_name', listing_performance.provider_name,
          'request_count', listing_performance.request_count,
          'completed_count', listing_performance.completed_count
        )
        order by listing_performance.request_count desc, listing_performance.provider_name
      ),
      '[]'::jsonb
    ) as listings
    from (
      select
        providers.id as provider_id,
        providers.name as provider_name,
        count(scoped_requests.id)::integer as request_count,
        count(scoped_requests.id) filter (
          where scoped_requests.status = 'completed'
        )::integer as completed_count
      from public.providers
      left join scoped_requests on scoped_requests.provider_id = providers.id
      where providers.owner_id = current_user_id
      group by providers.id, providers.name
    ) listing_performance
  )
  select jsonb_build_object(
    'window_days', window_days,
    'total_requests', totals.total_requests,
    'new_requests', totals.new_requests,
    'active_requests', totals.active_requests,
    'completed_requests', totals.completed_requests,
    'response_rate', coalesce(
      round(100.0 * totals.responded_requests / nullif(totals.total_requests, 0), 1),
      0
    ),
    'completion_rate', coalesce(
      round(100.0 * totals.completed_requests / nullif(totals.total_requests, 0), 1),
      0
    ),
    'average_response_minutes', totals.average_response_minutes,
    'quotes_sent', quote_totals.quotes_sent,
    'quotes_accepted', quote_totals.quotes_accepted,
    'quote_acceptance_rate', coalesce(
      round(100.0 * quote_totals.quotes_accepted / nullif(quote_totals.quotes_sent, 0), 1),
      0
    ),
    'completed_value_usd', totals.completed_value_usd,
    'completed_value_lbp', totals.completed_value_lbp,
    'listings', listing_totals.listings
  ) into result
  from totals
  cross join quote_totals
  cross join listing_totals;

  return result;
end;
$$;

revoke all on function public.get_provider_analytics(integer)
from public, anon;
grant execute on function public.get_provider_analytics(integer)
to authenticated;

comment on function public.get_provider_analytics(integer) is
  'Returns provider-owned request performance for a bounded 7-to-365-day window.';
