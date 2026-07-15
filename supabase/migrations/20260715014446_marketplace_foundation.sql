create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.categories (
  id bigint primary key,
  name text not null unique,
  name_ar text not null default '',
  icon text not null default 'construct-outline'
);

create table public.providers (
  id text primary key,
  category_id bigint not null references public.categories (id),
  name text not null,
  description text not null default '',
  address text not null default '',
  area text not null default '',
  phone text not null default '',
  whatsapp text not null default '',
  latitude double precision,
  longitude double precision,
  opening_hours jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  phone text not null default '',
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'ar')),
  default_area text not null default '',
  account_type text not null default 'customer'
    check (account_type in ('customer', 'provider')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id text not null references public.providers (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  provider_id text not null references public.providers (id) on delete cascade,
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 10 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reviews_one_per_user_provider
  on public.reviews (user_id, provider_id)
  where user_id is not null;
create index providers_category_id_idx on public.providers (category_id);
create index favorites_user_id_idx on public.favorites (user_id);
create index reviews_provider_id_idx on public.reviews (provider_id);
create index reviews_user_id_idx on public.reviews (user_id) where user_id is not null;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(trim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create function private.set_review_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication is required to write a review';
  end if;

  new.user_id := current_user_id;
  select coalesce(nullif(trim(p.full_name), ''), 'BeyBridge user')
    into new.author_name
    from public.profiles as p
    where p.id = current_user_id;

  new.author_name := coalesce(new.author_name, 'BeyBridge user');
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.set_review_owner() from public, anon, authenticated;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger providers_set_updated_at
before update on public.providers
for each row execute function private.set_updated_at();

create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, full_name, created_at)
select
  users.id,
  coalesce(trim(users.raw_user_meta_data ->> 'full_name'), ''),
  users.created_at
from auth.users as users
on conflict (id) do nothing;

insert into public.categories (id, name, name_ar, icon) values
  (1, 'Plumbers', 'سباكون', 'water-outline'),
  (2, 'Electricians', 'كهربائيون', 'flash-outline'),
  (3, 'Mechanics', 'ميكانيكيون', 'car-sport-outline'),
  (4, 'Roadside Tire Help', 'مساعدة إطارات', 'disc-outline'),
  (5, 'Car Battery Help', 'بطاريات سيارات', 'battery-charging-outline'),
  (6, 'Towing', 'سحب سيارات', 'car-outline'),
  (7, 'Cleaning Services', 'خدمات تنظيف', 'sparkles-outline'),
  (8, 'House Maintenance', 'صيانة منزلية', 'home-outline'),
  (9, 'AC Repair', 'تصليح مكيفات', 'snow-outline'),
  (10, 'Appliance Repair', 'تصليح أجهزة', 'build-outline'),
  (11, 'Carpenters', 'نجارون', 'hammer-outline'),
  (12, 'Painters', 'دهانون', 'color-palette-outline'),
  (13, 'Locksmiths', 'صانعو أقفال', 'key-outline'),
  (14, 'Pest Control', 'مكافحة حشرات', 'bug-outline'),
  (15, 'Moving Services', 'خدمات نقل', 'cube-outline'),
  (16, 'Mobile Car Wash', 'غسيل سيارات متنقل', 'car-outline'),
  (17, 'Handyman', 'عامل صيانة', 'construct-outline'),
  (18, 'Delivery & Errands', 'توصيل ومشاوير', 'bicycle-outline'),
  (19, 'Phone/Laptop Repair', 'تصليح هواتف وكمبيوتر', 'phone-portrait-outline'),
  (20, 'Laundry Services', 'خدمات غسيل', 'shirt-outline');

insert into public.providers (id, name, category_id, area, is_verified) values
  ('p1', 'RapidFlow Plumbing', 1, 'Hamra', true),
  ('p2', 'Beirut Electric Rescue', 2, 'Mar Elias', true),
  ('p3', 'Garage 961', 3, 'Quarantina', false),
  ('p4', 'RoadReady Tire Help', 4, 'Greater Beirut', true),
  ('p5', 'JumpStart Beirut', 5, 'Beirut', true),
  ('p6', 'SafeTow Lebanon', 6, 'Dora', true),
  ('p7', 'NeatNest Cleaning', 7, 'Achrafieh', true),
  ('p8', 'HomeCare Beirut', 8, 'Verdun', false),
  ('p9', 'CoolFix AC', 9, 'Furn El Chebbak', true),
  ('p10', 'Appliance Doctor', 10, 'Bourj Hammoud', false),
  ('p11', 'Cedar Woodworks', 11, 'Mar Mikhael', false),
  ('p12', 'FreshCoat Painters', 12, 'Badaro', false),
  ('p13', 'KeyNow Locksmith', 13, 'Ras Beirut', true),
  ('p14', 'ClearHome Pest Control', 14, 'Mazraa', true),
  ('p15', 'MoveWise Beirut', 15, 'Jnah', false),
  ('p16', 'WashWheels Mobile', 16, 'Beirut', false),
  ('p17', 'OneCall Handyman', 17, 'Cola', true),
  ('p18', 'Mishwar Express', 18, 'Central Beirut', true),
  ('p19', 'TechRevive Lab', 19, 'Hamra', true),
  ('p20', 'CleanFold Laundry', 20, 'Gemmayzeh', false);

insert into public.reviews (id, user_id, provider_id, author_name, rating, comment, created_at) values
  ('10000000-0000-4000-8000-000000000001', null, 'p1', 'Maya K.', 5, 'Arrived quickly and stopped the leak without making a mess.', '2026-06-20'),
  ('10000000-0000-4000-8000-000000000002', null, 'p2', 'Omar H.', 5, 'Found the electrical fault fast and explained the repair clearly.', '2026-06-12'),
  ('10000000-0000-4000-8000-000000000003', null, 'p4', 'Karim B.', 5, 'Reached me on the highway in under thirty minutes.', '2026-05-30'),
  ('10000000-0000-4000-8000-000000000004', null, 'p7', 'Rita F.', 5, 'Easy booking and the apartment felt brand new afterward.', '2026-06-25'),
  ('10000000-0000-4000-8000-000000000005', null, 'p13', 'Jad M.', 5, 'Professional, careful, and very quick during a stressful lockout.', '2026-07-01'),
  ('10000000-0000-4000-8000-000000000006', null, 'p19', 'Lina S.', 4, 'My laptop was ready the same day and the price was fair.', '2026-06-18');

create trigger reviews_set_owner
before insert or update on public.reviews
for each row execute function private.set_review_owner();

grant select on public.categories, public.providers, public.reviews to anon;
grant select on public.categories, public.providers, public.reviews to authenticated;
grant select, insert, update, delete on public.profiles, public.favorites, public.reviews to authenticated;
grant select, insert, update, delete on public.categories, public.providers, public.profiles, public.favorites, public.reviews to service_role;

alter table public.categories enable row level security;
alter table public.providers enable row level security;
alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.reviews enable row level security;

create policy "categories are publicly readable"
on public.categories for select
to anon, authenticated
using (true);

create policy "providers are publicly readable"
on public.providers for select
to anon, authenticated
using (true);

create policy "users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

create policy "users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users can read their own favorites"
on public.favorites for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can add their own favorites"
on public.favorites for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can remove their own favorites"
on public.favorites for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "reviews are publicly readable"
on public.reviews for select
to anon, authenticated
using (true);

create policy "users can create their own reviews"
on public.reviews for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update their own reviews"
on public.reviews for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can delete their own reviews"
on public.reviews for delete
to authenticated
using ((select auth.uid()) = user_id);
