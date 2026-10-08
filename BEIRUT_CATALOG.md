# Beirut map catalog

## Current status — 8 October 2026

**18 real OpenStreetMap records are now included in the app.** Publishing the
environment activated access to `overpass-api.de` and `www.openstreetmap.org`.
The live Overpass request succeeded, using Beirut administrative relation
[316552](https://www.openstreetmap.org/relation/316552), with source data timestamp
`2026-10-08T06:21:58Z`. This establishes their source, not current business activity.

| Service category | Listings |
| --- | ---: |
| Mechanics | 6 |
| AC services | 2 |
| Carpenters | 2 |
| Laundry / dry cleaning | 8 |

Six records have explicit international phone/mobile numbers; four have raw opening
hours. None has a sourced WhatsApp number, BeyBridge reviews, verification or owner
account. Names are unique in this snapshot. Source edit dates range back to 2017;
the UI advises confirming details directly. Coverage is sparse and does not support
launch claims across all twenty categories.

- Distributed database: [public/data/beirut-catalog.json](public/data/beirut-catalog.json).
- Reproducible source response: [public/data/beirut-source.json](public/data/beirut-source.json),
  with OSM contributor usernames and IDs removed, retaining geometry/tags/timestamps.
- Matching backend import: [supabase/catalogs/beirut-20261008.sql](supabase/catalogs/beirut-20261008.sql).
- Data licensing: [public/data/README.txt](public/data/README.txt). Expo web exports
  serve the machine-readable database and source under `/data/`; publish these
  alongside the app. This ODbL data is separate from private account records.

Without a configured backend, discovery now uses this real bundled snapshot.
Configured builds continue to use Supabase exclusively; an empty/erroring backend
does not silently reintroduce listings that may have been moderated or paused.
**No hosted database was modified:** there are no Supabase environment bindings or
local credentials in this environment. Apply the schema and reviewed import to the
connected backend before expecting these listings in a configured release.

The app no longer bundles fictional providers or reviews. Known ownerless seed IDs are filtered from
backend discovery, and the new migration pauses those rows and removes only the
six known null-author seed reviews. Owned listings and linked request/report
history are retained. Historical migrations still contain the old seed for
reproducibility; the later cleanup migration retires it.

Browser regression fixtures now live exclusively under `e2e/` and are supplied by
intercepted `.invalid` API requests. They are not an app fallback or shipped data.

## Refresh and deploy the data

1. The two OSM domains are now allowed and access was verified. The live command
   uses **Node 24** with environment-proxy
   support; the app's existing Node version range is unchanged.
2. Run `npm run import:beirut`. Alternatively, run the query exported as `QUERY`
   in `scripts/import-beirut-osm.cjs` against Overpass, save the complete JSON
   response, and run `node scripts/import-beirut-osm.cjs --input /path/response.json`.
3. Review `output/beirut-catalog/catalog.json`, `overpass-response.json`, and
   `import.sql`. These files are ignored by Git. No command here deploys a database
   change. Review business identity, duplicates across nodes/ways, category fit,
   coordinate precision and freshness, and sample phone/address details against
   the original linked map object. OSM is community data, not proof a business is
   active or verified. The source audit excluded a generic `مصبغة` category label,
   retained the French-only `Laudry express` name exactly as mapped, and preserved
   explicit `contact:mobile` numbers. English/Arabic/French source names are retained
   as search aliases; no business names or translations are invented. After review,
   update the distributed JSON/source and dated SQL together, removing contributor
   usernames/IDs from the distributed response, and run the reproducibility test.
4. Apply all pending migrations to staging, including
   `20261007130000_real_map_catalog.sql`, **before deploying this app version**:
   the client now selects `providers.map_source`. Execute the reviewed import SQL
   there using the trusted database administration connection. The current import
   file is `supabase/catalogs/beirut-20261008.sql`. Keep credentials
   out of the app and source control.
5. Run `supabase/tests/map_catalog.sql` and existing SQL suites with
   `psql -v ON_ERROR_STOP=1`, then verify real discovery, directions, attribution,
   reports/favorites, and the absence of booking for unclaimed directory entries.
   Confirm genuine owner listings still work and the app loads the full imported
   count (the current unpaginated Supabase query is subject to the project's row
   limit; add pagination if the reviewed catalog exceeds it). Only then promote
   to production.
6. Publish the distributable OSM-derived catalog separately with attribution,
   retrieval date, source URLs and ODbL license information; review the applicable
   ODbL share-alike/database-access obligations before publicly using it. Do not
   include private user records in that download. Establish a refresh/correction
   process and review disappeared businesses; refreshes deliberately do not
   auto-delete records or overwrite owned, paused or suspended listings.

## Scope and honest display

- Boundary: OSM administrative relation with `ISO3166-2=LB-BA`. No Greater Beirut
  bounding-box fallback. The importer assembles closed outer/inner rings, rejects
  missing geometry and partial/error responses, and excludes points/centers outside
  the boundary and inside holes. Empty imports fail without replacing output files.
- Only named services that match the existing taxonomy. Retail phone/computer
  shops require an explicit repair tag. Tyre shops and ordinary car washes are
  excluded because they do not establish roadside or mobile service availability.
  Several app categories may have no eligible OSM records; do not fill gaps with
  invented listings or assign an unrelated category.
- Preserve source identity, timestamps, coordinates, address components and explicit
  international contact numbers. WhatsApp is included only with its own source tag.
  Do not infer missing numbers, ratings, reviews, verification, prices or owner accounts.
- Raw OSM opening-hours syntax is shown on the detail screen; it is not translated
  into an unsupported schedule or counted as “Open now.” A future parser requires
  Beirut timezone, holiday and malformed-schedule tests.
- The database's required service/price enum values are storage defaults for imported
  rows. The UI shows **Not listed** while these directory entries have no owner,
  rather than claiming service setup or a quote. Booking requires an owner in the
  existing database workflow and is hidden for imported unclaimed entries.
- Map records have OSM attribution and a link to the original source. Native maps
  also retain their built-in map attribution. OSM data is not scraped Google Maps
  data, and importing a business does not mean it joined BeyBridge.

## Validation limits

`npm run test:catalog` tests edge cases with synthetic fixtures and reproduces the
real distributed catalog and SQL exactly from the retained source response. Synthetic
fixtures are never imported into the app. A separate browser project exercises the
actual bundled data without intercepting a provider API, including search, map,
attribution, unavailable booking/reviews and downloadable data. Unit/browser checks
do not verify current business operations or owner-confirmed contact accuracy. The
SQL suite and migration remain unexecuted; no database credentials are available
and the previous local Supabase image-registry attempt was blocked. Physical
Android/iPhone release checks and all publication prerequisites remain in
[PLAY_STORE_READINESS.md](PLAY_STORE_READINESS.md).
