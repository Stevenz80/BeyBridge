update public.providers as provider
set
  description = catalog.description,
  address = catalog.address,
  phone = catalog.phone,
  whatsapp = catalog.whatsapp,
  latitude = catalog.latitude,
  longitude = catalog.longitude,
  opening_hours = catalog.opening_hours
from (
  values
    (
      'p1',
      'Emergency leak repairs, blocked drains, water tanks, and bathroom plumbing with same-day visits.',
      'Hamra Street, near Commodore',
      '+9611341100',
      '9613110101',
      33.8959::double precision,
      35.4821::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Emergency calls"}'::jsonb
    ),
    (
      'p2',
      'Fast electrical fault finding, breaker repairs, rewiring, and inverter or generator connections.',
      'Mar Elias main road',
      '+9611702121',
      '9613110102',
      33.8825::double precision,
      35.4932::double precision,
      '{"mon":"24 hours","tue":"24 hours","wed":"24 hours","thu":"24 hours","fri":"24 hours","sat":"24 hours","sun":"24 hours"}'::jsonb
    ),
    (
      'p3',
      'Diagnostics, engine repairs, brakes, oil changes, and pre-purchase inspections for most car brands.',
      'Quarantina industrial area',
      '+9611580303',
      '9613110103',
      33.9012::double precision,
      35.5423::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p4',
      'Mobile flat-tire changes, puncture repair, tire inflation, and emergency roadside support.',
      'Mobile service across Greater Beirut',
      '+9613992404',
      '9613110104',
      33.8886::double precision,
      35.4955::double precision,
      '{"mon":"24 hours","tue":"24 hours","wed":"24 hours","thu":"24 hours","fri":"24 hours","sat":"24 hours","sun":"24 hours"}'::jsonb
    ),
    (
      'p5',
      'On-site jump starts, battery testing, and replacement battery delivery wherever your car is parked.',
      'Mobile service across Beirut',
      '+9613992505',
      '9613110105',
      33.8938::double precision,
      35.5018::double precision,
      '{"mon":"24 hours","tue":"24 hours","wed":"24 hours","thu":"24 hours","fri":"24 hours","sat":"24 hours","sun":"24 hours"}'::jsonb
    ),
    (
      'p6',
      '24/7 towing for breakdowns and accidents, with clear arrival times and careful vehicle handling.',
      'Operating from Dora highway',
      '+9613992606',
      '9613110106',
      33.9070::double precision,
      35.5660::double precision,
      '{"mon":"24 hours","tue":"24 hours","wed":"24 hours","thu":"24 hours","fri":"24 hours","sat":"24 hours","sun":"24 hours"}'::jsonb
    ),
    (
      'p7',
      'Home and office cleaning, deep cleans, move-in cleaning, and flexible weekly appointments.',
      'Sassine Square',
      '+9611202707',
      '9613110107',
      33.8885::double precision,
      35.5205::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p8',
      'Reliable preventive home maintenance and small repairs handled in one scheduled visit.',
      'Verdun 730',
      '+9611802808',
      '9613110108',
      33.8794::double precision,
      35.4865::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p9',
      'AC servicing, gas refills, leak detection, cleaning, installation, and urgent summer repairs.',
      'Furn El Chebbak main road',
      '+9611292909',
      '9613110109',
      33.8694::double precision,
      35.5218::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"10:00-15:00"}'::jsonb
    ),
    (
      'p10',
      'Diagnosis and repair for washing machines, refrigerators, ovens, dryers, and dishwashers.',
      'Bourj Hammoud main road',
      '+9611263010',
      '9613110110',
      33.8938::double precision,
      35.5439::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p11',
      'Custom shelves, door and cabinet repairs, furniture restoration, and precise on-site carpentry.',
      'Armenia Street',
      '+9611443111',
      '9613110111',
      33.8972::double precision,
      35.5244::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p12',
      'Interior and exterior painting with surface preparation, tidy work, and upfront estimates.',
      'Badaro Street',
      '+9611393212',
      '9613110112',
      33.8759::double precision,
      35.5162::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p13',
      'Urgent lockouts, lock replacement, door alignment, and key duplication at your location.',
      'Mobile service from Ras Beirut',
      '+9613993313',
      '9613110113',
      33.8998::double precision,
      35.4785::double precision,
      '{"mon":"24 hours","tue":"24 hours","wed":"24 hours","thu":"24 hours","fri":"24 hours","sat":"24 hours","sun":"24 hours"}'::jsonb
    ),
    (
      'p14',
      'Targeted treatment for ants, roaches, rodents, and bed bugs using home-safe methods.',
      'Corniche El Mazraa',
      '+9611663414',
      '9613110114',
      33.8772::double precision,
      35.4992::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p15',
      'Apartment and office moves with packing, furniture protection, loading, and assembly.',
      'Jnah service road',
      '+9611843515',
      '9613110115',
      33.8599::double precision,
      35.4863::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p16',
      'Water-conscious mobile car wash and interior cleaning at home, work, or your parking spot.',
      'Mobile service across Beirut',
      '+9613993616',
      '9613110116',
      33.8895::double precision,
      35.5010::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"9:00-14:00"}'::jsonb
    ),
    (
      'p17',
      'Curtain rods, shelves, TV mounting, furniture assembly, silicone work, and everyday fixes.',
      'Mobile service from Cola',
      '+9611703717',
      '9613110117',
      33.8724::double precision,
      35.4987::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p18',
      'Documents, pharmacy pickups, grocery runs, and small deliveries with live WhatsApp updates.',
      'Service across central Beirut',
      '+9613993818',
      '9613110118',
      33.8890::double precision,
      35.5040::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"10:00-18:00"}'::jsonb
    ),
    (
      'p19',
      'Same-day phone screens, batteries, laptop diagnostics, data recovery, and software repair.',
      'Bliss Street, near AUB',
      '+9611353919',
      '9613110119',
      33.9002::double precision,
      35.4792::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"Closed"}'::jsonb
    ),
    (
      'p20',
      'Wash and fold, dry cleaning, ironing, and scheduled pickup and delivery across nearby areas.',
      'Gouraud Street',
      '+9611444020',
      '9613110120',
      33.8954::double precision,
      35.5152::double precision,
      '{"mon":"8:00-18:00","tue":"8:00-18:00","wed":"8:00-18:00","thu":"8:00-18:00","fri":"8:00-18:00","sat":"8:00-16:00","sun":"10:00-16:00"}'::jsonb
    )
) as catalog (
  id,
  description,
  address,
  phone,
  whatsapp,
  latitude,
  longitude,
  opening_hours
)
where provider.id = catalog.id;

do $$
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
    raise exception 'Expected all 20 curated provider rows to contain complete presentation data';
  end if;
end;
$$;

comment on column public.providers.description is
  'Public service description. Curated and provider-owned listings use the same database source.';
