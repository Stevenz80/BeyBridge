-- Preserve request/report history and any listing with a real owner.
update public.providers set listing_status = 'paused', is_verified = false
where owner_id is null and id ~ '^p([1-9]|1[0-9]|20)$';

delete from public.reviews
where user_id is null and id::text ~ '^10000000-0000-4000-8000-00000000000[1-6]$';

alter table public.providers add column map_source jsonb;
comment on column public.providers.map_source is
  'Original OSM object URL, source timestamp, import timestamp, and unparsed opening_hours. Only trusted imports may write this.';

create function private.protect_map_source()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') or (select auth.role()) in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      if new.map_source is not null then raise exception 'Map provenance is managed by the importer'; end if;
    elsif new.map_source is distinct from old.map_source then
      raise exception 'Map provenance is managed by the importer';
    end if;
  end if;
  return new;
end;
$$;
create trigger providers_protect_map_source before insert or update on public.providers
for each row execute function private.protect_map_source();

-- Existing service_requests policies and prepare_service_request already require
-- a real provider_owner_id. Directory imports intentionally keep owner_id null.
