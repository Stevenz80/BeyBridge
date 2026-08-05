insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'provider-verification',
  'provider-verification',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "providers can upload pending verification documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'provider-verification'
  and array_length(storage.foldername(name), 1) = 2
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and lower(storage.extension(name)) in ('pdf', 'jpg', 'jpeg', 'png')
  and exists (
    select 1
    from public.provider_verification_requests
    where provider_verification_requests.id::text = (storage.foldername(name))[2]
      and provider_verification_requests.provider_owner_id = (select auth.uid())
      and provider_verification_requests.status = 'pending'
  )
);

create policy "providers and administrators can read verification documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'provider-verification'
  and (
    owner_id = (select auth.uid())::text
    or exists (
      select 1
      from public.platform_admins
      where platform_admins.user_id = (select auth.uid())
    )
  )
);

create policy "providers can remove editable verification documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'provider-verification'
  and owner_id = (select auth.uid())::text
  and exists (
    select 1
    from public.provider_verification_requests
    where provider_verification_requests.id::text = (storage.foldername(name))[2]
      and provider_verification_requests.provider_owner_id = (select auth.uid())
      and provider_verification_requests.status in ('pending', 'withdrawn', 'rejected')
  )
);

comment on policy "providers can upload pending verification documents" on storage.objects is
  'Private evidence uploads are limited to the authenticated owner and a pending verification request.';

comment on policy "providers and administrators can read verification documents" on storage.objects is
  'Verification evidence is never public; only the uploader and platform administrators can read it.';
