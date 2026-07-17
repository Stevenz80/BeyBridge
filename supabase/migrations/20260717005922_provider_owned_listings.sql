alter table public.providers
  add column owner_id uuid references auth.users (id) on delete cascade,
  add column listing_status text not null default 'published'
    check (listing_status in ('draft', 'published', 'paused')),
  add column service_mode text not null default 'mobile'
    check (service_mode in ('mobile', 'on_site', 'both')),
  add column price_type text not null default 'quote'
    check (price_type in ('quote', 'hourly', 'fixed')),
  add column starting_price numeric(12, 2)
    check (starting_price is null or starting_price >= 0),
  add column price_currency text not null default 'USD'
    check (price_currency in ('USD', 'LBP')),
  add column years_experience smallint
    check (years_experience is null or years_experience between 0 and 80),
  add column emergency_service boolean not null default false;

alter table public.providers
  alter column id set default gen_random_uuid()::text,
  alter column listing_status set default 'draft';

alter table public.providers
  add constraint providers_published_listing_complete check (
    owner_id is null
    or listing_status <> 'published'
    or (
      char_length(trim(name)) between 2 and 120
      and char_length(trim(description)) between 30 and 2000
      and char_length(trim(area)) between 2 and 120
      and char_length(trim(phone)) between 7 and 30
      and opening_hours <> '{}'::jsonb
      and (price_type = 'quote' or starting_price is not null)
    )
  );

create index providers_owner_id_idx
  on public.providers (owner_id)
  where owner_id is not null;

create index providers_published_category_idx
  on public.providers (category_id, created_at desc)
  where listing_status = 'published';

drop policy "providers are publicly readable" on public.providers;

create policy "published providers and owned listings are readable"
on public.providers for select
to anon, authenticated
using (
  listing_status = 'published'
  or owner_id = (select auth.uid())
);

create policy "providers can create their own listings"
on public.providers for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.account_type = 'provider'
  )
);

create policy "providers can update their own listings"
on public.providers for update
to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.account_type = 'provider'
  )
);

create policy "providers can delete their own listings"
on public.providers for delete
to authenticated
using (owner_id = (select auth.uid()));

drop policy "users can update their own profile" on public.profiles;

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and (
    account_type = 'provider'
    or not exists (
      select 1
      from public.providers
      where providers.owner_id = (select auth.uid())
    )
  )
);

drop policy "users can add their own favorites" on public.favorites;

create policy "users can save published listings they do not own"
on public.favorites for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.providers
    where providers.id = provider_id
      and providers.listing_status = 'published'
      and providers.owner_id is distinct from (select auth.uid())
  )
);

drop policy "users can create their own reviews" on public.reviews;

create policy "users can review published listings they do not own"
on public.reviews for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.providers
    where providers.id = provider_id
      and providers.listing_status = 'published'
      and providers.owner_id is distinct from (select auth.uid())
  )
);

revoke insert, update, delete on public.providers from authenticated;

grant insert (
  owner_id,
  category_id,
  name,
  description,
  address,
  area,
  phone,
  whatsapp,
  latitude,
  longitude,
  opening_hours,
  listing_status,
  service_mode,
  price_type,
  starting_price,
  price_currency,
  years_experience,
  emergency_service
) on public.providers to authenticated;

grant update (
  category_id,
  name,
  description,
  address,
  area,
  phone,
  whatsapp,
  latitude,
  longitude,
  opening_hours,
  listing_status,
  service_mode,
  price_type,
  starting_price,
  price_currency,
  years_experience,
  emergency_service
) on public.providers to authenticated;

grant delete on public.providers to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, account_type)
  values (
    new.id,
    coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case
      when new.raw_user_meta_data ->> 'account_type' = 'provider' then 'provider'
      else 'customer'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
