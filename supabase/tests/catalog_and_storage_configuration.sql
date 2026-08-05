begin;

do $$
declare
  configured_policy_count integer;
begin
  if (
    select count(*)
    from public.providers
    where owner_id is null
      and description <> ''
      and address <> ''
      and phone <> ''
      and whatsapp <> ''
      and latitude is not null
      and longitude is not null
      and opening_hours <> '{}'::jsonb
  ) <> 20 then
    raise exception 'The curated provider catalog is not fully stored in Supabase';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'provider-verification'
      and not public
      and file_size_limit = 5242880
      and allowed_mime_types @> array['application/pdf', 'image/jpeg', 'image/png']::text[]
  ) then
    raise exception 'The private verification bucket restrictions are incomplete';
  end if;

  select count(*) into configured_policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and policyname in (
      'providers can upload pending verification documents',
      'providers and administrators can read verification documents',
      'providers can remove editable verification documents'
    )
    and 'authenticated' = any(roles);

  if configured_policy_count <> 3 then
    raise exception 'Expected all three authenticated verification Storage policies';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like '%verification%'
      and ('anon' = any(roles) or 'public' = any(roles))
  ) then
    raise exception 'Verification Storage must not expose an anonymous or public policy';
  end if;
end;
$$;

update public.providers
set moderation_status = 'suspended', listing_status = 'paused'
where id = 'p1';

set local role anon;

do $$
begin
  if exists (select 1 from public.providers where id = 'p1') then
    raise exception 'A suspended curated provider remained publicly visible';
  end if;
end;
$$;

reset role;
rollback;
