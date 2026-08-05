alter table public.providers
  add constraint providers_valid_coordinates_check
  check (
    (latitude is null and longitude is null)
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  );

comment on constraint providers_valid_coordinates_check on public.providers is
  'Coordinates must be absent together or contain a valid latitude-longitude pair.';
