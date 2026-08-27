create or replace function public.claim_verification_admin_emails(p_limit integer default 25)
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

revoke all on function public.claim_verification_admin_emails(integer)
from public, anon, authenticated;
grant execute on function public.claim_verification_admin_emails(integer)
to service_role;
