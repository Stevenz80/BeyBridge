drop policy "providers can withdraw pending verification requests"
on public.provider_verification_requests;

drop policy "administrators can review verification requests"
on public.provider_verification_requests;

create policy "providers and administrators can update verification requests"
on public.provider_verification_requests for update
to authenticated
using (
  (provider_owner_id = (select auth.uid()) and status = 'pending')
  or exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
)
with check (
  provider_owner_id = (select auth.uid())
  or exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);

drop policy "active published providers are publicly readable"
on public.providers;

drop policy "owners and administrators can read managed listings"
on public.providers;

create policy "active published providers are anonymously readable"
on public.providers for select
to anon
using (
  listing_status = 'published' and moderation_status = 'active'
);

create policy "authenticated users can read available or managed providers"
on public.providers for select
to authenticated
using (
  (listing_status = 'published' and moderation_status = 'active')
  or owner_id = (select auth.uid())
  or exists (
    select 1
    from public.platform_admins
    where platform_admins.user_id = (select auth.uid())
  )
);
