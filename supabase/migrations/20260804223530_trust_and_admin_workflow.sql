create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.providers
  add column moderation_status text not null default 'active'
    check (moderation_status in ('active', 'suspended')),
  add column moderation_reason text not null default ''
    check (char_length(moderation_reason) <= 1000),
  add column moderated_at timestamptz,
  add column moderated_by uuid references auth.users (id) on delete set null;

create table public.provider_verification_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.providers (id) on delete cascade,
  provider_owner_id uuid not null references auth.users (id) on delete cascade,
  provider_name text not null,
  business_registration text not null default ''
    check (char_length(business_registration) <= 200),
  license_number text not null default ''
    check (char_length(license_number) <= 200),
  evidence_summary text not null
    check (char_length(trim(evidence_summary)) between 30 and 2000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reporter_name text not null,
  target_type text not null check (target_type in ('provider', 'review')),
  provider_id text not null references public.providers (id) on delete restrict,
  review_id uuid references public.reviews (id) on delete set null,
  target_name text not null,
  target_snapshot text not null default '' check (char_length(target_snapshot) <= 1200),
  reason text not null
    check (reason in ('misleading', 'spam', 'abuse', 'safety', 'fraud', 'other')),
  details text not null check (char_length(trim(details)) between 10 and 2000),
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text not null default '' check (char_length(admin_note) <= 1000),
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (
    (target_type = 'provider' and review_id is null)
    or target_type = 'review'
  )
);

create table public.provider_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null references public.providers (id) on delete cascade,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('suspend', 'restore')),
  reason text not null check (char_length(trim(reason)) between 10 and 1000),
  created_at timestamptz not null default now()
);

create unique index provider_verification_one_pending_idx
  on public.provider_verification_requests (provider_id)
  where status = 'pending';

create index provider_verification_owner_created_idx
  on public.provider_verification_requests (provider_owner_id, submitted_at desc);

create index provider_verification_provider_id_idx
  on public.provider_verification_requests (provider_id);

create index provider_verification_status_created_idx
  on public.provider_verification_requests (status, submitted_at);

create index provider_verification_reviewed_by_idx
  on public.provider_verification_requests (reviewed_by)
  where reviewed_by is not null;

create unique index reports_one_open_provider_per_user_idx
  on public.reports (reporter_id, provider_id)
  where target_type = 'provider' and status in ('open', 'reviewing');

create unique index reports_one_open_review_per_user_idx
  on public.reports (reporter_id, review_id)
  where target_type = 'review' and status in ('open', 'reviewing');

create index reports_status_created_idx on public.reports (status, created_at);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_provider_id_idx on public.reports (provider_id);
create index reports_review_id_idx on public.reports (review_id) where review_id is not null;
create index reports_reviewed_by_idx on public.reports (reviewed_by) where reviewed_by is not null;

create index provider_moderation_provider_created_idx
  on public.provider_moderation_actions (provider_id, created_at desc);

create index provider_moderation_admin_id_idx
  on public.provider_moderation_actions (admin_id);

create index providers_moderation_status_idx
  on public.providers (moderation_status)
  where moderation_status = 'suspended';

create index providers_moderated_by_idx
  on public.providers (moderated_by)
  where moderated_by is not null;

create index platform_admins_granted_by_idx
  on public.platform_admins (granted_by)
  where granted_by is not null;

create function private.prepare_verification_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  listing_owner_id uuid;
  listing_verified boolean;
  listing_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to request verification';
  end if;

  select providers.owner_id, providers.is_verified, providers.name
    into listing_owner_id, listing_verified, listing_name
    from public.providers
    where providers.id = new.provider_id;

  if listing_owner_id is null or listing_owner_id <> current_user_id then
    raise exception 'You can only verify a listing that you own';
  end if;

  if listing_verified then
    raise exception 'This listing is already verified';
  end if;

  new.provider_owner_id := current_user_id;
  new.provider_name := listing_name;
  new.status := 'pending';
  new.admin_note := '';
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$$;

create function private.guard_verification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_admin boolean;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to update verification';
  end if;

  select exists (
    select 1 from public.platform_admins where user_id = current_user_id
  ) into is_admin;

  if new.provider_id is distinct from old.provider_id
    or new.provider_owner_id is distinct from old.provider_owner_id
    or new.provider_name is distinct from old.provider_name
    or new.business_registration is distinct from old.business_registration
    or new.license_number is distinct from old.license_number
    or new.evidence_summary is distinct from old.evidence_summary
    or new.submitted_at is distinct from old.submitted_at then
    raise exception 'Verification submission details are immutable';
  end if;

  if is_admin then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Administrators can only approve or reject pending verification';
    end if;
    new.admin_note := trim(new.admin_note);
    new.reviewed_by := current_user_id;
    new.reviewed_at := now();
  elsif old.provider_owner_id = current_user_id then
    if old.status <> 'pending' or new.status <> 'withdrawn' then
      raise exception 'Providers can only withdraw a pending verification request';
    end if;
    if new.admin_note is distinct from old.admin_note
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Providers cannot change administrator fields';
    end if;
  else
    raise exception 'You do not have access to update this verification request';
  end if;

  return new;
end;
$$;

create function private.apply_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' then
    update public.providers set is_verified = true where id = new.provider_id;
  elsif new.status = 'rejected' then
    update public.providers set is_verified = false where id = new.provider_id;
  end if;
  return new;
end;
$$;

create function private.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  profile_name text;
  target_owner_id uuid;
  review_owner_id uuid;
  target_label text;
  target_content text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to submit a report';
  end if;

  if new.target_type = 'provider' then
    if new.provider_id is null or new.review_id is not null then
      raise exception 'Choose one provider to report';
    end if;

    select providers.owner_id, providers.name
      into target_owner_id, target_label
    from public.providers
    where providers.id = new.provider_id
      and providers.listing_status = 'published'
      and providers.moderation_status = 'active';

    if not found then
      raise exception 'This provider is not available to report';
    end if;
  elsif new.target_type = 'review' then
    if new.review_id is null then
      raise exception 'Choose one review to report';
    end if;

    select reviews.provider_id, reviews.user_id, reviews.author_name, reviews.comment
      into new.provider_id, review_owner_id, target_label, target_content
      from public.reviews
      where reviews.id = new.review_id;

    if not found then
      raise exception 'This review is not available to report';
    end if;
  else
    raise exception 'Unsupported report target';
  end if;

  if target_owner_id = current_user_id or review_owner_id = current_user_id then
    raise exception 'You cannot report your own content';
  end if;

  select profiles.full_name into profile_name
  from public.profiles
  where profiles.id = current_user_id;

  new.reporter_id := current_user_id;
  new.reporter_name := coalesce(nullif(trim(profile_name), ''), 'BeyBridge user');
  new.target_name := coalesce(nullif(trim(target_label), ''), 'Reported content');
  new.target_snapshot := coalesce(left(trim(target_content), 1200), '');
  new.status := 'open';
  new.admin_note := '';
  new.reviewed_by := null;
  new.resolved_at := null;
  return new;
end;
$$;

create function private.guard_report_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_admin boolean;
begin
  select exists (
    select 1 from public.platform_admins where user_id = current_user_id
  ) into is_admin;

  if current_user_id is null or not is_admin then
    raise exception 'Administrator access is required to update reports';
  end if;

  if new.reporter_id is distinct from old.reporter_id
    or new.reporter_name is distinct from old.reporter_name
    or new.target_type is distinct from old.target_type
    or new.provider_id is distinct from old.provider_id
    or new.review_id is distinct from old.review_id
    or new.target_name is distinct from old.target_name
    or new.target_snapshot is distinct from old.target_snapshot
    or new.reason is distinct from old.reason
    or new.details is distinct from old.details
    or new.created_at is distinct from old.created_at then
    raise exception 'Report submission details are immutable';
  end if;

  if not (
    (old.status = 'open' and new.status in ('reviewing', 'resolved', 'dismissed'))
    or (old.status = 'reviewing' and new.status in ('resolved', 'dismissed'))
  ) then
    raise exception 'Unsupported report status change';
  end if;

  new.admin_note := trim(new.admin_note);
  new.reviewed_by := current_user_id;
  new.resolved_at := case
    when new.status in ('resolved', 'dismissed') then now()
    else null
  end;
  return new;
end;
$$;

create function private.prepare_moderation_action()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  is_admin boolean;
  current_status text;
begin
  select exists (
    select 1 from public.platform_admins where user_id = current_user_id
  ) into is_admin;

  if current_user_id is null or not is_admin then
    raise exception 'Administrator access is required to moderate providers';
  end if;

  select providers.moderation_status into current_status
  from public.providers
  where providers.id = new.provider_id;

  if not found then
    raise exception 'Provider listing not found';
  end if;

  if (new.action = 'suspend' and current_status = 'suspended')
    or (new.action = 'restore' and current_status = 'active') then
    raise exception 'This moderation action is already in effect';
  end if;

  new.admin_id := current_user_id;
  new.reason := trim(new.reason);
  return new;
end;
$$;

create function private.apply_moderation_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.providers
  set
    moderation_status = case when new.action = 'suspend' then 'suspended' else 'active' end,
    moderation_reason = new.reason,
    moderated_at = now(),
    moderated_by = new.admin_id,
    listing_status = case when new.action = 'suspend' then 'paused' else listing_status end
  where id = new.provider_id;
  return new;
end;
$$;

revoke all on function private.prepare_verification_request() from public, anon, authenticated;
revoke all on function private.guard_verification_update() from public, anon, authenticated;
revoke all on function private.apply_verification_decision() from public, anon, authenticated;
revoke all on function private.prepare_report() from public, anon, authenticated;
revoke all on function private.guard_report_update() from public, anon, authenticated;
revoke all on function private.prepare_moderation_action() from public, anon, authenticated;
revoke all on function private.apply_moderation_action() from public, anon, authenticated;

create trigger verification_requests_prepare_insert
before insert on public.provider_verification_requests
for each row execute function private.prepare_verification_request();

create trigger verification_requests_guard_update
before update on public.provider_verification_requests
for each row execute function private.guard_verification_update();

create trigger verification_requests_set_updated_at
before update on public.provider_verification_requests
for each row execute function private.set_updated_at();

create trigger verification_requests_apply_decision
after update on public.provider_verification_requests
for each row execute function private.apply_verification_decision();

create trigger reports_prepare_insert
before insert on public.reports
for each row execute function private.prepare_report();

create trigger reports_guard_update
before update on public.reports
for each row execute function private.guard_report_update();

create trigger reports_set_updated_at
before update on public.reports
for each row execute function private.set_updated_at();

create trigger moderation_actions_prepare_insert
before insert on public.provider_moderation_actions
for each row execute function private.prepare_moderation_action();

create trigger moderation_actions_apply
after insert on public.provider_moderation_actions
for each row execute function private.apply_moderation_action();

revoke all on table
  public.platform_admins,
  public.provider_verification_requests,
  public.reports,
  public.provider_moderation_actions
from anon, authenticated, service_role;

grant select on public.platform_admins to authenticated;

grant select on
  public.provider_verification_requests,
  public.reports,
  public.provider_moderation_actions
to authenticated;

grant insert (
  provider_id,
  business_registration,
  license_number,
  evidence_summary
) on public.provider_verification_requests to authenticated;

grant update (status, admin_note)
on public.provider_verification_requests to authenticated;

grant insert (
  target_type,
  provider_id,
  review_id,
  reason,
  details
) on public.reports to authenticated;

grant update (status, admin_note)
on public.reports to authenticated;

grant insert (provider_id, action, reason)
on public.provider_moderation_actions to authenticated;

grant select, insert, update, delete on
  public.platform_admins,
  public.provider_verification_requests,
  public.reports,
  public.provider_moderation_actions
to service_role;

alter table public.platform_admins enable row level security;
alter table public.provider_verification_requests enable row level security;
alter table public.reports enable row level security;
alter table public.provider_moderation_actions enable row level security;

create policy "administrators can read their own role"
on public.platform_admins for select
to authenticated
using (user_id = (select auth.uid()));

create policy "providers and administrators can read verification requests"
on public.provider_verification_requests for select
to authenticated
using (
  provider_owner_id = (select auth.uid())
  or exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

create policy "providers can submit verification requests"
on public.provider_verification_requests for insert
to authenticated
with check (
  provider_owner_id = (select auth.uid())
  and exists (
    select 1 from public.providers
    where providers.id = provider_id
      and providers.owner_id = (select auth.uid())
      and not providers.is_verified
  )
);

create policy "providers can withdraw pending verification requests"
on public.provider_verification_requests for update
to authenticated
using (provider_owner_id = (select auth.uid()) and status = 'pending')
with check (provider_owner_id = (select auth.uid()));

create policy "administrators can review verification requests"
on public.provider_verification_requests for update
to authenticated
using (
  exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

create policy "reporters and administrators can read reports"
on public.reports for select
to authenticated
using (
  reporter_id = (select auth.uid())
  or exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

create policy "users can submit their own reports"
on public.reports for insert
to authenticated
with check (reporter_id = (select auth.uid()));

create policy "administrators can update reports"
on public.reports for update
to authenticated
using (
  exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

create policy "providers and administrators can read moderation history"
on public.provider_moderation_actions for select
to authenticated
using (
  exists (
    select 1 from public.providers
    where providers.id = provider_id
      and providers.owner_id = (select auth.uid())
  )
  or exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

create policy "administrators can moderate providers"
on public.provider_moderation_actions for insert
to authenticated
with check (
  admin_id = (select auth.uid())
  and exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

drop policy "providers can delete their own listings" on public.providers;

create policy "providers can delete active listings without retained history"
on public.providers for delete
to authenticated
using (
  owner_id = (select auth.uid())
  and moderation_status = 'active'
);

drop policy "published providers and owned listings are readable" on public.providers;

create policy "active published providers are publicly readable"
on public.providers for select
to anon, authenticated
using (
  listing_status = 'published' and moderation_status = 'active'
);

create policy "owners and administrators can read managed listings"
on public.providers for select
to authenticated
using (
  owner_id = (select auth.uid())
  or exists (
    select 1 from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

drop policy "users can save published listings they do not own" on public.favorites;

create policy "users can save active published listings they do not own"
on public.favorites for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.providers
    where providers.id = provider_id
      and providers.listing_status = 'published'
      and providers.moderation_status = 'active'
      and providers.owner_id is distinct from (select auth.uid())
  )
);

drop policy "users can review published listings they do not own" on public.reviews;

create policy "users can review active published listings they do not own"
on public.reviews for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.providers
    where providers.id = provider_id
      and providers.listing_status = 'published'
      and providers.moderation_status = 'active'
      and providers.owner_id is distinct from (select auth.uid())
  )
);

create or replace function private.prepare_service_request()
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
  listing_moderation_status text;
  profile_name text;
  profile_phone text;
begin
  if current_user_id is null then
    raise exception 'Authentication is required to request a service';
  end if;

  select
    providers.owner_id,
    providers.name,
    providers.listing_status,
    providers.moderation_status
    into listing_owner_id, listing_name, listing_status, listing_moderation_status
    from public.providers
    where providers.id = new.provider_id;

  if listing_owner_id is null
    or listing_status <> 'published'
    or listing_moderation_status <> 'active' then
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

revoke all on function private.prepare_service_request() from public, anon, authenticated;

comment on table public.platform_admins is
  'Platform administrator assignments. Populate only through trusted SQL or service-role tooling.';

comment on table public.provider_verification_requests is
  'Provider-submitted verification evidence and administrator decisions.';

comment on table public.reports is
  'User reports for provider listings and reviews.';

comment on table public.provider_moderation_actions is
  'Append-only administrator suspension and restoration audit log.';
