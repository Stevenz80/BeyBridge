-- Run with psql -v ON_ERROR_STOP=1 on a fully migrated staging/local Supabase DB.
-- Synthetic fixtures and every change are rolled back.
begin;
do $$
declare
  owner_uuid uuid := gen_random_uuid();
  listing_id text := gen_random_uuid()::text;
  category bigint;
  source jsonb := '{"kind":"openstreetmap","url":"https://www.openstreetmap.org/node/1"}';
begin
  if exists (select 1 from public.providers where owner_id is null
      and id ~ '^p([1-9]|1[0-9]|20)$' and listing_status = 'published') then
    raise exception 'Legacy dummy providers are still published';
  end if;
  if exists (select 1 from public.reviews where user_id is null
      and id::text ~ '^10000000-0000-4000-8000-00000000000[1-6]$') then
    raise exception 'Legacy synthetic reviews remain';
  end if;

  insert into auth.users (id, email, raw_user_meta_data, created_at, updated_at)
  values (owner_uuid, owner_uuid || '@example.invalid',
    '{"full_name":"Map catalog test","account_type":"provider"}', now(), now());
  select min(id) into category from public.categories;
  insert into public.providers (id, owner_id, category_id, name, listing_status)
  values (listing_id, owner_uuid, category, 'Owned regression fixture', 'draft');

  perform set_config('request.jwt.claim.sub', owner_uuid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
  begin
    update public.providers set map_source = source where id = listing_id;
    raise exception 'An owner forged map provenance';
  exception when raise_exception then
    if sqlerrm <> 'Map provenance is managed by the importer' then raise; end if;
  end;
  update public.providers set name = 'Legitimate owner edit' where id = listing_id;
  if not exists (select 1 from public.providers where id = listing_id and name = 'Legitimate owner edit') then
    raise exception 'Normal owner edits were blocked';
  end if;
  execute 'reset role';
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.providers set map_source = source where id = listing_id;
  if not exists (select 1 from public.providers where id = listing_id and map_source = source) then
    raise exception 'Trusted import could not record provenance';
  end if;
end;
$$;
rollback;
