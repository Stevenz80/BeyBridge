insert into private.platform_admin_email_allowlist (email)
values
  ('stevenoueiss10@gmail.com'),
  ('stevenoueiss11@gmail.com')
on conflict (email) do nothing;

insert into public.platform_admins (user_id, note)
select
  users.id,
  'Granted automatically from the BeyBridge administrator email allowlist.'
from auth.users as users
join private.platform_admin_email_allowlist as allowed
  on allowed.email = lower(trim(coalesce(users.email, '')))
on conflict (user_id) do nothing;

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
