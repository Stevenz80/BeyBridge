alter table public.service_requests
  add column service_latitude double precision,
  add column service_longitude double precision,
  add constraint service_requests_coordinate_pair_check check (
    (service_latitude is null and service_longitude is null)
    or (service_latitude is not null and service_longitude is not null)
  ),
  add constraint service_requests_latitude_check check (
    service_latitude is null or service_latitude between -90 and 90
  ),
  add constraint service_requests_longitude_check check (
    service_longitude is null or service_longitude between -180 and 180
  );

comment on column public.service_requests.service_latitude is
  'Exact customer-selected service latitude. Null when the customer supplies text only.';

comment on column public.service_requests.service_longitude is
  'Exact customer-selected service longitude. Null when the customer supplies text only.';
