# Production readiness — 6 September 2026

Status: improved, not yet release-certified. Changes in this pass are local and uncommitted;
the new database migration and notification worker changes have not been deployed.

## Implemented

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

## Verification completed

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

1. **Database validation and deployment:** start local/staging Supabase and run the new
   `supabase/tests/verified_admin_email.sql` plus existing verification and authorization tests
   against the migrated database. Docker/Podman is not installed here, so no SQL execution is
   claimed. Apply the migration to the hosted project only after those checks pass.
2. **Worker integration tests and deployment:** simulate Expo throttling, receipt outages, invalid
   tokens, and an email-send success followed by a database failure. Redeploy the worker, then
   confirm actual phone receipt in foreground/background and notification-tap navigation. A push
   ticket/receipt is not proof that the user saw the notification.
3. **Release-device QA:** build and install the updated native app (haptics changes require a native
   rebuild). Check slow/fast/interrupted sheet swipes, partial-height list scrolling, dragging the
   entire footer, selection cards, large fonts, keyboard, location denial, and Arabic/RTL. The last
   Android build was not confirmed successful. Google-Maps-like gesture quality still needs this test.
4. **Authenticated journeys:** customer request → provider quote/accept/complete → review prompt;
   favorites and profile links; listing activation; verified admin vs ordinary user; logout/account
   switching during in-flight requests; recovery from offline/auth-expired states.
5. **Release configuration:** explicitly gate fixture/demo mode so an unconfigured release cannot
   silently show sample listings. Verify OAuth redirects, Apple sign-in setup, production sender
   domain, FCM/APNs, Sentry, privacy/terms, account deletion, store metadata, and signing credentials.
   Do not assume previously configured services are missing; verify their deployed state.
6. **Scale and data quality:** provider/review queries currently fetch whole collections subject to
   API row limits. Add server-side pagination/search before growing beyond the current small catalog;
   review retries, account-specific fetch cancellation, and distinct ratings-unavailable UI.

## Reference guidance

- [Expo push delivery and retry guidance](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [Supabase user-data and trigger guidance](https://supabase.com/docs/guides/auth/managing-user-data)

The Expo animation, React Native, UI/UX, debugging, and Supabase skills informed the focused changes.
The custom map sheet was retained because the installed native bottom-sheet abstraction is modal
and does not support this always-interactive map with three custom detents.
