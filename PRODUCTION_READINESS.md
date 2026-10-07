# Production readiness — 7 October 2026

Status: improved, not yet release-certified. Development continues on `latest-working-version`
from `b75f22c1`. The database migration and notification worker changes remain undeployed;
their hosted behavior has not been verified.

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

### Current evidence

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
