# Production readiness — 8 October 2026

## Map toolbar overlap — `fix/map-toolbar-overlap`

- Reproduced the screenshot issue: the location browser's full-screen scroll viewport
  let listing icons/cards scroll behind transparent gaps in the floating search and
  filter controls. The controls themselves had the correct 8px separation, but
  obscured cards could also receive taps through those gaps.
- Inset the fallback location browser's scroll viewport below the toolbar instead
  of using content padding that scrolls away. The toolbar now reports its actual
  height for viewport/camera padding, including loading/error messages and expanded
  sheet states. The native map remains interactive and retains the custom sheet.
- The original regression failed with the list starting 114px above the filters'
  lower edge. The corrected 412px capture has filters ending at y=114 and the list
  starting at y=130: a clear 16px gap, with no listing hit targets behind the toolbar.
- Browser checks cover 320/375/412px widths, Arabic, populated search/clear controls,
  list scrolling, selection, sheet detents and error/retry toolbar resizing. Native
  release validation of safe areas, large fonts, keyboard and selected-marker camera
  padding remains required on Android/iPhone; browser geometry is not device proof.
- Verification: all 25 relevant browser cases passed (24 map/discovery/catalog,
  one error/retry regression), three web exports succeeded, TypeScript and full
  ESLint passed, and the final test edits passed targeted lint. Before/after browser
  captures confirmed that the circles visible in the original screenshot were removed.

## Beirut catalog task — `feat/beirut-map-catalog`

- Removed fictional providers/reviews from the runtime; preserved them only as
  intercepted API fixtures under `e2e/`. Categories remain normal app taxonomy.
- Known ownerless seed listings and synthetic null-author seed reviews are filtered
  from discovery as an additional client safeguard. Empty catalogs show an honest message.
  No owner-maintained listings are hidden by the legacy seed filter.
- Added an undeployed cleanup/provenance migration, an OSM boundary-limited import
  preparation command, source attribution/detail links, missing-data display, and
  no booking CTA for unclaimed imported directory entries. The import never executes
  SQL, overwrites owned/paused/suspended records, or manufactures reviews/verification.
- **Real source access now works after environment publication.** Retrieved and
  inspected 18 OSM records inside Beirut relation 316552. The unconfigured app now
  browses the attributed snapshot in `public/data/beirut-catalog.json`; configured
  builds retain Supabase as their only catalog authority. Six explicit phone/mobile
  numbers, four raw schedules and multilingual search names are preserved; missing
  data, unverified status and absent owner accounts remain explicit. No fictional
  ratings or business details were added. Older source data needs business confirmation.
- Saved the distributable ODbL database, sanitized source response and reproducible
  `supabase/catalogs/beirut-20261008.sql`. No backend credentials are present, so the
  schema cleanup and data import are **not deployed**. Local browsing of a bundled
  snapshot does not certify hosted favorite/report/RLS behavior.
- Two new browser regressions failed against the previous export: legacy dummy rows
  were visible and empty discovery had no explanation. After the fixes: TypeScript
  and full ESLint passed; all **71 browser tests** passed, including the four new
  catalog regressions; both web exports succeeded; all **6 importer tests** passed.
  Exported JavaScript was checked for legacy fixture business names/review text.
  These were the 7 October results. The 8 October checks add real-snapshot
  reproducibility and browser discovery without provider API mocks; results below.
- **8 October verification:** TypeScript and full ESLint passed; all 10 importer
  tests passed, including exact real-snapshot/SQL reproduction. Three web exports
  succeeded and contain none of the 20 former fictional names or six review texts.
  All 71 existing browser cases passed. The initial expanded run passed 74/75:
  one new test mistakenly counted the “View these services on the map” navigation
  button as a provider. After correcting the assertion to check the actual empty
  state/count, all four real-catalog cases passed on rerun. No application change
  was needed for that test correction. Reviewed narrow-screen browser captures of
  the real map selection and provider details; native gestures remain untested.
- Deployment order matters: apply `20261007130000_real_map_catalog.sql` before this
  app release because the client reads the new `map_source` column. The SQL regression
  in `supabase/tests/map_catalog.sql` is not executed; Supabase image downloads remain
  blocked. Do not confuse mocked API checks with hosted database validation.

See [BEIRUT_CATALOG.md](BEIRUT_CATALOG.md) for source/import/licensing steps and
[PLAY_STORE_READINESS.md](PLAY_STORE_READINESS.md#publication-plan-after-the-beirut-catalog-task)
for the ordered whole-app publication plan, including the deferred support-email
reminder and earlier physical-device/backend validations.

Status: improved, not yet release-certified. The active store-readiness task is on
`feat/play-store-readiness`; its implementation, evidence and deferred owner questions
are recorded below and in [PLAY_STORE_READINESS.md](PLAY_STORE_READINESS.md).
Password recovery was implemented on `feat/password-recovery`, based on `efd68ec9`.
The map review started from `b75f22c1`; this app-wide pass started from `b60bcbf7`.
The database migration and notification worker changes remain undeployed;
their hosted behavior has not been verified.

## Password recovery

- Email sign-in now has a Forgot password entry with email prefilling. Reset requests validate
  and normalize the address, show neutral account-existence feedback, retain input after
  failure, handle rate limits, prevent concurrent sends, and apply a 60-second resend cooldown.
- `/auth/reset-password` handles initial and subsequent native links through the global
  linking listener. It verifies implicit recovery credentials or exchanges a PKCE code,
  then permits password entry for that session's account. Ordinary signed-in sessions,
  missing/malformed links, and rejected tokens do not automatically open the form.
  Browser credentials are removed from the URL before network verification. Connection
  failures are distinguished from invalid/expired links; a new email link is available.
- The form confirms the new password and enforces the existing eight-character minimum.
  It preserves input on retryable update errors, handles expired/re-authentication-required
  sessions, blocks simultaneous submissions, clears fields on account changes, and shows
  explicit success with a return to the account. Recovery copy and controls are localized
  in Arabic; scroll content respects the keyboard and bottom safe area.
- A regression reproduced the shared SDK's late `USER_UPDATED` response overwriting a
  different signed-in account. Each password update now uses captured recovery credentials
  in a separate non-persisting Auth client with no BroadcastChannel, then disposes it. An
  account change invalidates the original form/result while preserving the new session.

The new recovery routes own their link handling instead of competing with automatic web
session detection. Ordinary OAuth callbacks keep their existing automatic detection.
Recovery permission is in memory: after refreshing a sanitized reset page, reopen the
email link or request a new one. This UI gate does not replace Supabase authorization.

Verification: `npx tsc --noEmit`, full `npm run lint`, and `git diff --check` passed.
`EXPO_NO_TELEMETRY=1 PLAYWRIGHT_BROWSER_PATH=/usr/bin/chromium npm run test:e2e:web`
exported both web modes and passed **58 tests** (2.5 minutes): the previous 41 journeys and
17 recovery cases, including native/web URL parsing, email normalization and retry, neutral
unknown-account feedback, rate limits, invalid/expired links, connection failures, password
validation/update retry, session loss/re-authentication, a single PKCE exchange, account
change during a pending update, Arabic at 320×568, and ordinary OAuth callback recovery.
The account-switch regression failed before isolating the Auth client; a later failing
session-loss case identified the SDK's `AuthSessionMissingError` mapping, which is now
handled explicitly. Requests use generated sessions and the isolated mocked API; no real
reset emails or hosted password changes were performed.

Android and iOS Hermes exports also passed together with `npx expo export --platform android
--platform ios --max-workers 2`, using dummy backend configuration and a temporary output
directory. These validate bundling of the new routes and Auth client, not installed builds,
email delivery, deep-link behavior, or device performance.

Open deployment/device checks: allowlist `beybridge://auth/reset-password` and the deployed
web origin's `/auth/reset-password`, retain `{{ .ConfirmationURL }}` in the mail template,
and verify SMTP delivery/rate limits. Use staging accounts to test real valid, expired,
and reused emails, secure password-change policy, subsequent sign-in with the new password,
and native cold/warm links on installed Android/iPhone builds. No hosted auth settings,
email templates, SMTP configuration, database migration, or worker was deployed in this pass.

## Request and review follow-up

This pass continued from `2cd8ba0c` and focused on customer/provider responses and
review recovery, without changing the map implementation.

- Provider details distinguish loading or unavailable ratings from a provider with no
  reviews. Review failures have a visible retry action; successful retries clear the error.
  Completed-request prompts wait for reviews to load successfully before opening or
  acknowledging the prompt, so a failed fetch does not consume the opportunity to review.
- Review drafts close on account or provider-route changes. Request response drafts,
  feedback, and busy state also belong to the current account/request. Late work from
  a dismissed review form cannot close a newly opened draft, and stale review mutation
  callbacks reject an account change.
- Request update failures and invalid quotes have persistent inline feedback. Retrying
  an action clears the previous error. Quote fields, review comments, and submission
  controls have explicit accessible names; new recovery copy is localized in Arabic.
- Request cancellation, withdrawal, decline, completion, and review deletion use native
  confirmation dialogs on Android/iPhone and browser confirmation on web. React Native
  Web's empty `Alert.alert` implementation previously made these confirmations inert.

Nine configured browser journeys cover review recovery, account/dismissal draft races,
request update retry, cancellation, completion prompt recovery, review publishing/deletion,
and quote → customer acceptance → scheduling → start → completion → review prompting.
Eight regressions failed against the previous export before their fixes. The workflow
asserts that status updates retain the existing status condition; its mocked responses do
not execute or validate Supabase triggers, policies, audit events, or notifications.

Verification: `npx tsc --noEmit`, full `npm run lint`, and `git diff --check` passed.
`EXPO_NO_TELEMETRY=1 PLAYWRIGHT_BROWSER_PATH=/usr/bin/chromium npm run test:e2e:web`
exported both web modes and passed **41 tests** (2.0 minutes for the browser run): the
previous 32 regressions plus the nine request/review journeys. Both new and existing
journeys use fixtures or the isolated mocked API; no hosted records were changed.

Native confirmations, keyboard/focus behavior, screen readers, large text, RTL layout,
and physical-device animation performance still need Android/iPhone release-build QA.
Listing lifecycle, hosted transaction rules, token expiry, concurrent status conflicts,
and duplicate submission remain open verification items.

## App-wide audit and fixes

The next pass audited account/profile editing, saved services, customer requests,
notifications, administrator entry, and their shared data providers. It reproduced
account-switch races and recovery failures against an isolated mocked Supabase API.

- Private state now belongs to an account session. Switching or signing out hides the
  previous profile, favorites, requests, notifications, administrator status, and trust
  queues immediately, before the next fetch. Delayed responses and optimistic rollbacks
  from the previous account cannot repopulate that state. Public discovery and navigation
  remain mounted. Saving a profile, listing, or request rejects continuation after an account change.
- An open profile editor closes when the account changes, preventing the old account's
  draft details from becoming the next account's editable profile.
- Profile and saved-service failures now have visible retry feedback. Failed loading no
  longer masquerades as an empty saved-services account. Account errors are kept separate
  from review errors, and successful account reloads clear them.
- Request details offer retry when fetching fails, instead of reporting a missing request.
  Starting a request also distinguishes provider/profile loading failures from unavailable
  services or missing phone details.
- Profile and request fields have explicit accessible names. Profile editing and request
  submission controls have meaningful names without decorative icon glyphs. New recovery
  messages are localized in Arabic.

Account browser tests use a separate configured bundle targeting `beybridge-e2e.invalid`,
with generated test sessions, mocked HTTP responses, and closed test WebSockets. The normal
anonymous fixture bundle remains separate. Exporting each mode clears Metro's transform
cache because the public configuration is inlined; otherwise a configured test can silently
reuse the unconfigured bundle. Neither project contacts the hosted Supabase database.

### Verification for the app-wide pass

- `npx tsc --noEmit`, full `npm run lint`, and `git diff --check` passed.
- `EXPO_NO_TELEMETRY=1 PLAYWRIGHT_BROWSER_PATH=/usr/bin/chromium npm run test:e2e:web`
  exported both web modes and passed **32 tests** in the final run (1.4 minutes): the existing
  17 discovery/map tests and 15 configured mock-backend journeys.
- Regressions failed before the fixes for delayed profile replacement, private requests and
  notifications across account changes, stale administrator UI, old favorite rollback, profile
  editor drafts, accessible field/control names, and profile/favorites/request failure recovery.
  The successful submission journey also verified that a failed send retained the entered job
  description/address and that retry reached the new request's details.
- No hosted authentication, database policies, backend deployment, native push delivery, or
  installed Android/iPhone build was validated in this pass. Native exports listed below belong
  to the earlier map review; they are not device evidence for these changes.

### App-wide priorities after this batch

1. Validate the complete customer/provider transaction: listing creation/editing and status
   changes → request → quote/accept → schedule/complete → review, including mutation failures,
   logout, token expiry, duplicate submission, and concurrent status updates. Current mocked
   coverage is a frontend check, not validation of the hosted rules or full transaction.
2. Complete hosted account-recovery verification. The new password-reset flow above needs
   real email delivery and subsequent sign-in checks. Verify email confirmation and OAuth/
   deep-link recovery on both native platforms.
3. Extend review availability handling to catalog/map rating summaries, then address
   catalog/review pagination and production fixture gating. Provider-detail recovery and
   completed-request review prompting are covered by the follow-up above.
4. Check native keyboard handling, screen-reader focus/order, large text, Arabic/RTL, and
   release performance across profile, request, listing, saved-service, and notification screens.
   Retain the native map, database, and push-delivery gates below.

## Latest UI/UX review

- Anonymous visitors are no longer treated as listing or review owners when both IDs are
  missing. Customer save/request controls remain available; sample reviews do not show “You.”
- Provider details show loading/retry feedback while discovery is pending or failed rather
  than reporting a missing provider prematurely. Bottom tabs include the device's bottom safe area.
- All services and viewport searches can open map results without a category or text query.
  Empty text searches have an action that clears the search and filters. A direct map entry
  can return home, and selected-provider cards have an explicit close control.
- Selecting a place, including the same place again, reveals the map from an expanded sheet.
  Settled selections still do not reopen a sheet after a downward swipe. The existing custom
  three-detent sheet and its UI-thread gesture implementation are retained.
- Map/fallback padding follows the settled panel height. Native selection preserves a closer
  zoom, respects reduced motion, and does not refocus on a provider-object refresh. Interactive
  camera controls wait for actual map readiness and disappear when the map fails.
- Search submission, category changes, and selection dismiss the keyboard. Directions open
  a destination route with handled link errors and an HTTPS fallback for Apple Maps.
- The sheet handle has a web keyboard alternative. Arabic search-intent headings, place counts,
  recovery messages, and category metadata are localized.

### Evidence from the preceding map review

- Fetched and fast-forward checked `latest-working-version`; no upstream changes were pending.
  `npm ci` passed with Node 24.19.0, within the required `>=22.13 <25` range.
- `npx tsc --noEmit` and full `npm run lint` passed after reinstalling dependencies.
- `npm run test:e2e:web` exported the web app and passed all **17 tests** on mobile Chromium
  (30.7 seconds in the latest run). Coverage includes the existing marketplace journeys plus
  all-services discovery, selection/dismissal, repeated selection, directions URL, location
  denial, keyboard activation, direct-entry navigation, narrow-screen recovery, Arabic, and
  anonymous ownership. Tests use fixtures and intercept outgoing directions requests.
- Android, iOS, and web Expo exports passed earlier in this review. These produce JavaScript/
  Hermes bundles; they are not signed native builds or device-performance evidence.
- Seventeen rendered layout checks across 393×852, 320×568, and 852×393 screens, including
  Arabic phone layouts, found no horizontal page overflow or JavaScript page errors.
- Online `npx expo install --check` was blocked by the environment's HTTP proxy (`Forbidden`).
  `EXPO_OFFLINE=1 npx expo install --check` found dependencies up to date; Expo explicitly warns
  that offline validation is unreliable. Online compatibility verification remains open.
- Exports still warn about the absent local `google-services.json` and optional Sentry
  organization/project configuration. No native APK/IPA build success is claimed.

### Map findings that still need native validation

The installed MapLibre 11.3.7 `Marker` implementation positions native views without collision
handling. A north-up, unpitched Web Mercator estimate for the 20 fixture providers and 38-point
marker bodies found 18 overlapping pairs at zoom 11.5, all 190 pairs at zoom 8, and one pair at
zoom 14. This is a geometric diagnostic, not a screenshot or test of the live provider catalog.
Rating labels and touch regions can overlap beyond these body-only estimates. Clustering or
decluttering with category logos and selected-marker priority remains necessary to evaluate
on the real map; this review does not certify crowding as resolved.

There is no attached physical device or available Android/iOS simulator toolchain in this
workspace. Browser tests render the accessible location-list fallback, so they do not exercise
native MapLibre, tile failures, camera padding, keyboard resizing, or gesture frame timing.
The 12-second initial-loading timeout, failure fallback, and retry path exist in code; offline
tiles and recovery after an already-loaded map loses connectivity remain unverified.

See [UI_UX_REVIEW.md](UI_UX_REVIEW.md) for the focused changes and browser evidence.

## Earlier production changes

- Map results no longer restart their entrance animation after each swipe. A selected service
  no longer forces a collapsed sheet open again. Interrupting an animation starts the new drag
  from its current position, and changing detents does not unexpectedly scroll the results.
- The results list uses the visible settled sheet height, with a draggable footer and three
  velocity-sensitive detents. Reduced-motion preferences also apply to selection scrolling.
- The accumulated map pass adds “Search this area,” preserves the camera during viewport
  searches, shortens the search hint, and positions map controls around the active bottom panel.
- Live Supabase startup no longer shows sample reviews while the actual reviews are loading or
  unavailable. Fetch exceptions clear their loading state rather than leaving a permanent spinner.
- Home, search, saved services, and map discovery show service loading/retry feedback. Search and
  saved services do not report an empty directory while the provider fetch is loading or failed.
  These new messages have Arabic translations; previously fetched results remain usable on failure.
- Automatic administrator grants require a confirmed, allowlisted email. The migration reacts to
  confirmation and email changes and repairs invalid automatically generated grants. Manual grants
  are left intact. The existing allowlist remains limited to stevenoueiss10@gmail.com.
- Push ticket rate-limit errors retry with the existing bounded backoff. Receipt-service outages
  stop retrying after the configured limit. Verification emails use a stable Resend idempotency key
  to reduce duplicate sends within Resend's idempotency retention window.
- README now separates the notification email recipient from dashboard authorization and avoids
  describing implemented features as fully production-verified.

## Earlier verification (6 September)

- TypeScript: `npx tsc --noEmit` passed.
- Targeted ESLint on changed marketplace/map/screens passed.
- Web export and all 7 marketplace browser smoke tests passed. The new regression test failed
  before the sheet fix and passed afterward. Coverage includes semantic search, map filters,
  Arabic shell, anonymous account/request flows, and anonymous admin-route protection.
- Deno type check of `supabase/functions/process-push-notifications/index.ts` passed.
- Supabase CLI created `20260906131638_require_verified_admin_email.sql`.

Browser tests deliberately use fixture data without contacting live Supabase. They do not prove
authenticated workflows, live network-error recovery, Android gestures, or push delivery.

## Next, in priority order

1. **Physical Android release QA, then iPhone QA:** install a release or near-release build
   that includes MapLibre. Check slow drag, fast flick, interruption mid-spring, immediate
   reversal, all three detents, footer dragging, nested list scrolling, marker/repeated selection,
   keyboard, large font sizes, Arabic/RTL, location denial, and reduced motion. Profile dropped
   frames and JS/UI stalls in the release build, not Expo Go. Inspect control/safe-area overlap
   on small screens and selected-marker visibility at every detent. This remains the required
   gate for Google-Maps-like gesture quality.
2. **Native map density and recovery:** reproduce the measured crowding, then add regression
   coverage and implement clustering/decluttering while preserving category logos and selected
   priority. Check initial loading, tile/network failure, retry, offline use, and reconnect recovery
   without a blank/black map. Verify screen-reader order, selection focus, labels, contrast,
   touch targets, and large text on both platforms.
3. **Database validation and deployment:** start local/staging Supabase and run the new
   `supabase/tests/verified_admin_email.sql` plus existing verification and authorization tests
   against the migrated database. Docker/Podman is not installed here, so no SQL execution is
   claimed. Apply the migration to the hosted project only after those checks pass.
4. **Worker integration tests and deployment:** simulate Expo throttling, receipt outages, invalid
   tokens, and an email-send success followed by a database failure. Redeploy the worker, then
   confirm actual phone receipt in foreground/background and notification-tap navigation. A push
   ticket/receipt is not proof that the user saw the notification.
5. **Authenticated journeys:** customer request → provider quote/accept/complete → review prompt;
   favorites and profile links; listing activation; verified admin vs ordinary user; logout/account
   switching during in-flight requests; recovery from offline/auth-expired states.
6. **Release configuration:** explicitly gate fixture/demo mode so an unconfigured release cannot
   silently show sample listings. Verify OAuth redirects, Apple sign-in setup, production sender
   domain, FCM/APNs, Sentry, privacy/terms, account deletion, store metadata, and signing credentials.
   Do not assume previously configured services are missing; verify their deployed state.
7. **Scale and data quality:** provider/review queries currently fetch whole collections subject to
   API row limits. Add server-side pagination/search before growing beyond the current small catalog;
   review retries, account-specific fetch cancellation, and distinct ratings-unavailable UI.

## Reference guidance

- [Expo push delivery and retry guidance](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Supabase user-data and trigger guidance](https://supabase.com/docs/guides/auth/managing-user-data)

The Expo animation, React Native, UI/UX, debugging, and Supabase skills informed the focused changes.
The custom map sheet was retained because the installed native bottom-sheet abstraction is modal
and does not support this always-interactive map with three custom detents.
## Play Store readiness implementation — 2026-10-07

Branch: `feat/play-store-readiness`, based on `feat/password-recovery` (`8b18df4a`).
The complete submission checklist and deferred owner questions are recorded in
[PLAY_STORE_READINESS.md](PLAY_STORE_READINESS.md). This work does not certify
Google Play acceptance or a production/native release.

Implemented public privacy/community-rule/deletion pages and a shared plain-HTML
export, permanent account deletion with server-side identity verification and file/
dependent-record cleanup, private user blocking/unblocking with marketplace filtering
and a policy preventing new requests in both directions, publication agreement,
administrator review removal with an audit snapshot, and production AAB/configuration
checks. Critical deletion/agreement copy is localized in Arabic. The installed custom
map sheet and existing map behavior are preserved.

Verification completed:

- `npx tsc --noEmit`, full `npm run lint`, and `git diff --check` passed.
- `EXPO_NO_TELEMETRY=1 PLAYWRIGHT_BROWSER_PATH=/usr/bin/chromium npm run test:e2e:web`
  exported anonymous/configured web bundles and passed **67 tests (3.5 minutes)**.
  This includes the previous 58 journeys plus nine store-readiness cases: anonymous
  policy access, explicit deletion confirmation/success/sign-out, failure/retry,
  account changes during a pending deletion, provider blocking/unblocking, hidden
  review authors and account isolation, community agreement/read-without-losing-draft,
  administrator review removal, and Arabic deletion at 320×568.
- The first browser pass exposed the new checkbox's missing web checked-state
  semantics. React Native Web requires `aria-checked`; the component now supplies
  it alongside the native accessibility state. Failed initial checks also identified
  test reseeding and ambiguous selector issues, which were corrected without
  weakening the behavior assertions. Review regressions now exercise the agreement
  requirement before publishing and still verify save retry and draft isolation.
- `node --test scripts/play-store-config.test.cjs` passed **4 tests**, covering missing/
  placeholder release details, public URL restrictions, matching Firebase/AAB settings,
  client secret-key rejection, and HTML escaping/readability without JavaScript.
- `npm exec --yes --package=deno -- deno test supabase/functions/delete-account/handler_test.ts`
  passed **9 tests**. These use a fake Supabase client to verify authentication/
  confirmation, verified-user binding, cleanup order, error handling, bounded storage
  cleanup, and CORS. No real accounts/files were deleted.
- `npm exec --yes --package=deno -- deno check supabase/functions/delete-account/index.ts`
  passed. Endpoint compilation is not deployed authorization/integration evidence.
- Android and iOS Hermes exports passed together with `npx expo export --platform android
  --platform ios --max-workers 2 --output-dir /tmp/beybridge-play-store-native`, using
  the reserved dummy backend configuration. These are JS/native-module bundling checks,
  not APK/AAB/IPA builds or gesture/permission/device validation.
- `npx expo config --type introspect --json` succeeded. Its Android manifest directives
  remove overlay, background location, microphone and broad media/storage permissions.
  Foreground coarse/fine location remains. Library manifests and the final merged AAB
  must still be examined. Installed React Native defaults target/compile API 36; the
  current Google Play target requirement was not verified against an uploaded artifact.
- `npm run export:store-pages -- --draft` produced reviewable HTML. Nothing was published.
  `npm run check:play-store` **correctly failed** because real backend/contact/retention/
  public URLs and `google-services.json` are missing. This is an open release prerequisite.
- Online `npx expo install --check` failed with proxy `Forbidden`; no dependency versions
  or lockfile entries were changed. Google's official policy pages also returned proxy
  HTTP 403, so their latest deadlines must be rechecked before submission.

Backend deployment/SQL remains pending. Docker is now available, but attempting a local
Supabase stack failed because `public.ecr.aws` image pulls were forbidden. The attempted
local stack was stopped. `supabase/tests/store_account_safety.sql` is rollback-safe but
**unexecuted**, as are the new deletion/blocking/moderation migrations against a real
Supabase database. No hosted database, Edge Function, auth settings or Play Console
configuration was changed. Older verified-admin and notification-worker deployment
checks below remain open.

Retain these reminders for the owner: create the new monitored BeyBridge support inbox
later, confirm operator identity and actual backup/log/processor retention, complete and
publish the policy/deletion HTML, test deployed customer/provider/admin deletion and
blocking on staging, inspect a signed release AAB including 16 KB native-library support,
complete Play Console declarations/testing/reviewer access, and perform physical Android
release and iPhone accessibility/keyboard/RTL/device QA. Real password-recovery delivery/
deep links and all earlier map gesture, crowding, camera, network and profiling checks
remain pending. Browser account-switch coverage concerns a pending endpoint response;
concurrent auth changes during SDK cleanup, cross-tab behavior, and interrupted/lost
deletion responses still need integration validation.
