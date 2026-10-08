# Google Play submission readiness

## Publication plan after the whole-app UI/UX audit

Active branch: `fix/app-ui-ux-audit`, based on `feat/beirut-category-coverage`
(`1cd04898`). **20 real Beirut OSM records are bundled as of 8 October 2026;
hosted database import and release certification remain pending.**
The ordered plan below covers the whole app, not only the map.
The browser audit and code cleanup are recorded in [UI_UX_AUDIT.md](UI_UX_AUDIT.md).

| Order | Work and completion evidence | Who / dependency |
| --- | --- | --- |
| 1 | The OSM snapshot is fetched, source-audited, attributed and bundled: 20 records across six categories, eight phone numbers. Find at least one supported Beirut listing for each of the 14 uncovered categories using first-party sources or owner submissions, with explicit mobile/roadside evidence where required; a full city import is deferred. Remove legacy seed data in staging, execute the reviewed SQL import, confirm business/contact freshness, publish the included `/data/` files and establish refresh/correction ownership. Keep launch claims within actual coverage. | Developer + accessible business sources and staging database; no backend configuration is currently available here. See [BEIRUT_CATALOG.md](BEIRUT_CATALOG.md) for all 20 category counts. |
| 2 | Run all SQL suites, deploy pending migrations and notification/deletion workers to staging, then validate customer/provider requests, RLS, verification, moderation, blocking, uploads, notifications and actual account deletion. Record rollback/recovery results before production deployment. | Developer + staging credentials/accessible Supabase runtime. Existing backend changes remain undeployed. |
| 3 | Create the new monitored BeyBridge support/privacy email; confirm operator identity, actual retention and public URLs; review and publish final privacy/terms/deletion pages. Exercise emailed deletion requests. | Owner decision **deferred at your request; ask later**. |
| 4 | Test real sign-up/email delivery and password recovery, expired/reused links, auth redirects, native cold/warm links and account switching with the configured backend. | Developer + real SMTP and installed Android/iPhone builds. |
| 5 | Browser UI/UX regressions and code cleanup have been implemented. Validate the whole app on physical Android and iPhone: keyboard, safe areas, small screens, large fonts, Arabic/RTL, screen readers, reduced motion, permission denial and offline recovery. Profile the map in an Android release build, including marker crowding, sheet gestures, selected-marker visibility and tile failure/retry. | Device testing; browser results are not sufficient. See the audit for browser evidence. |
| 6 | Configure release credentials/Firebase/backend/legal values, pass `npm run check:play-store`, build a signed AAB, inspect final permissions/target API and all native libraries for 16 KB compatibility. Enable production crash monitoring and confirm redaction/retention. | Developer + release configuration. No AAB has been built or inspected here. |
| 7 | Complete Play Console verification, Data safety, content/age/ads declarations, app-access reviewer accounts, screenshots/descriptions and any required closed testing. Check current policies in Console. | Owner + developer; account-specific requirements must be confirmed. |
| 8 | Run internal/closed testing and the Play pre-launch report; fix crashes/ANRs and critical journey failures. Confirm support/moderation coverage, database backups/recovery and monitoring, then submit a staged production release. | Release sign-off after evidence from steps 1–7. |

Do not label imported businesses “verified,” claim Google affiliation, or advertise
coverage/categories that the actual catalog does not support. The import removes
fictional content from the app bundle, but neither a successful build nor these
notes establish store acceptance.

The store-readiness changes below originated on 7 October 2026 in
`feat/play-store-readiness`, based on `feat/password-recovery` (`8b18df4a`).
The active branch and current publication plan are listed above. This is an
implementation and validation record, not a claim of Google Play acceptance.

## Previously implemented store-readiness changes

- Public in-app privacy, community-rule, and deletion-information pages, reachable
  from signed-in and signed-out account screens. The same source produces plain
  HTML pages without JavaScript, login, or an app installation requirement.
- Account → Delete account: clear permanent-deletion explanation, account identity,
  explicit `DELETE` confirmation, duplicate-submit protection, errors/retry, and
  local sign-out after a successful server response. A late response cannot sign
  out a different account that signed in while deletion was pending.
- Server-side deletion authenticates the bearer token with Supabase Auth and derives
  the account ID from that verified identity. It never trusts a request-body ID.
  The service-role key exists only in the Edge Function environment.
- Deletion locks evidence uploads, removes verification objects through the Storage
  API in bounded batches, removes dependent marketplace records and copied inbox
  notifications, then deletes Auth through the admin API. Storage/database failures
  return an error rather than claiming success. Partial failures can require a retry;
  already-removed files/records are not restored. Shared requests are also removed.
- Provider/review-author blocking with private, account-scoped persistent block lists,
  immediate listing/review filtering across marketplace/map/saved views, and an
  unblock screen. A database policy prevents new service requests in both directions.
  Existing requests remain accessible; external calls/chats are unaffected.
- Explicit community agreement in sign-up mode and before review/listing publication.
  Reading terms preserves the current form. Dashboard publication now opens the
  listing editor for review/agreement; pausing keeps its existing behavior.
- Administrators can remove reported reviews, resolve the report with a reason, and
  preserve the snapshot for moderation. Reports retain a link to the target account
  so account deletion also removes snapshots after the original review was removed.
- Production EAS builds explicitly produce an Android App Bundle and run a release
  configuration check. Missing/placeholder backend, legal/contact/retention details,
  public legal URLs, Firebase configuration, and client-exposed service-role keys
  fail this check. Development/preview builds are not blocked by the production hook.
- Android manifest merge directives remove overlay, background-location, microphone,
  and broad media/storage permissions. Foreground location and the system document
  picker remain. Check the final release manifest and device behavior before upload.

## Information to ask the owner for later

The owner explicitly requested these be deferred and retained in the notes:

- Create a **new, monitored BeyBridge support/privacy inbox**; then provide its public
  email address. Do not invent an address or publish a nonfunctional contact.
- Confirm the operator/legal name and any applicable local legal disclosures.
- Confirm backup/log/diagnostic/email retention with the actual service configuration,
  including any legally required exceptions. Review these policy drafts against actual
  processing and processor deletion obligations before publishing them.
- Choose the public web origin and final privacy/deletion URLs.

Until these values are supplied, legal pages display a draft notice and the production
release check deliberately fails. English legal documents are drafts; critical deletion
and agreement UI copy is localized in Arabic, but bilingual legal review is still pending.

## Deferred monetization discussion

The owner wants to discuss providers paying to be listed after publication, including
the best monetization approach. Keep this for a later decision; it is not an approved
pricing or payment design. No paid-listing gate, subscription or payment flow is
implemented in this task. The immediate coverage goal is a small, real Beirut catalog
with at least one suitable listing per category, rather than importing every service.

## Configure and publish the legal pages

Set the following in local/EAS production configuration; names are in `.env.example`:

```text
EXPO_PUBLIC_LEGAL_OPERATOR
EXPO_PUBLIC_SUPPORT_EMAIL
EXPO_PUBLIC_BACKUP_RETENTION
EXPO_PUBLIC_LOG_RETENTION
EXPO_PUBLIC_PRIVACY_URL
EXPO_PUBLIC_ACCOUNT_DELETION_URL
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Use only a publishable/anonymous Supabase key in the client. Supply the existing,
ignored `google-services.json` for `com.beybridge.app` through the build configuration.

```sh
npm run check:play-store
npm run export:store-pages -- --draft  # local review with visible draft notice
npm run export:store-pages             # release export after configuration is complete
```

The export creates `dist-store/privacy.html`, `terms.html`, and `delete-account.html`.
Deploy these files alongside the web app on the chosen public origin; the deletion
page links to `/account/delete` and also explains how to request deletion by email
without installing the app. Verify all pages publicly, without cookies/sign-in, from
outside the development environment. Exporting files does not deploy them or prove
the configured URL is reachable. The support inbox needs a documented, monitored
ownership-verification and fulfillment process; never ask for passwords/OTP codes.

## Backend deployment and validation — pending

Nothing in this task was deployed to the hosted database or Edge Functions.

Deploy in dependency order after testing on a migrated staging database:

```text
supabase/migrations/20261007120000_account_deletion.sql
supabase/migrations/20261007121000_user_blocking.sql
supabase/migrations/20261007122000_review_moderation.sql
supabase/functions/delete-account/
```

The deletion function intentionally has `verify_jwt = false` at the gateway and
verifies the bearer token with `auth.getUser(token)` itself. It requires server-side
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; neither belongs in an `EXPO_PUBLIC_*`
variable. Its privileged RPCs are executable only by `service_role`.

Run `supabase/tests/store_account_safety.sql` with `psql -v ON_ERROR_STOP=1` on a
migrated local/staging database. It creates rollback-safe fixtures for authorization,
bidirectional blocking, review moderation, guarded foreign-key cleanup, provider
deletion with retained history, storage preconditions, retry, and copied notifications.
This SQL test is **not executed here**: Docker is available, but Supabase image pulls
from `public.ecr.aws` were denied by the environment proxy. No hosted workaround was
used. The SQL fixture removes only mock storage metadata; actual object removal needs
an integration test through Storage and the Edge Function.

Use disposable staging accounts to validate customer, provider, and administrator
deletion; pending/approved/withdrawn documents; reports on already-deleted reviews;
notification/push cleanup; invalid/expired JWTs; repeated/concurrent requests; upload
concurrency; network failure at each phase; and lost responses after Auth deletion.
In-flight external email/push deliveries and existing diagnostic/backups require
retention/deletion review. Historical reports whose reviews were already removed
before this migration cannot always be backfilled to their original author; review
and resolve those records before publishing a comprehensive deletion claim.

Previously committed but still undeployed/unverified work remains:

```text
supabase/migrations/20260906131638_require_verified_admin_email.sql
supabase/tests/verified_admin_email.sql
supabase/functions/process-push-notifications/index.ts
```

## Play Console and release checks — pending

Google's official policy pages below were inaccessible here (proxy HTTP 403). These
are stable submission areas to verify against the **current** Console requirements;
do not rely on this document for current deadlines or final eligibility.

| Area | What remains before submission |
| --- | --- |
| Developer account | Complete identity/organization verification, contact details and payments-profile requirements. |
| Privacy and deletion | Publish completed policies and deletion resource; enter their public URLs in the Console. Test real deletion and the monitored email-request process. |
| Data safety | Declare actual backend/SDK behavior, optional collection, sharing, encryption, deletion and retention. Audit Supabase, Expo/FCM, map/tile providers, configured mail services and optional Sentry. |
| User-generated content | Validate reporting, user blocking, administrator removal/suspension, moderation staffing, appeal/contact handling and agreement before publication. |
| App access | Supply functioning reviewer accounts/instructions for restricted customer/provider/admin flows; avoid requiring personal OTPs. Ensure review data is clearly test data. |
| Content/age declarations | Complete content rating, target audience, ads and other applicable declarations based on the actual app/business. Do not infer child-directed status or financial/payment functionality. |
| Closed testing | Check whether the account is subject to new-personal-account testing/production-access requirements and complete the Console's specified tester count and duration. |
| Store listing | Provide accurate app name, description, app icon, feature graphic, Android screenshots and support contact. Avoid claims of Google affiliation or unverified service quality. |
| Release artifact | Build a signed production AAB with the existing application ID, version management and Play App Signing. Verify target API against current policy. Installed React Native defaults target/compile API **36**, but no compiled AAB was examined. |
| Native libraries | Check **16 KB page-size compatibility** of every shipped `.so`, including MapLibre and Hermes, using the actual AAB/device tools. Modern Gradle configuration or successful JS exports alone does not prove this. |
| Permissions | Inspect the merged release manifest; verify foreground-only location, notification denial, document picking without broad storage access, and absence of debug/overlay permissions. |
| Quality | Run the Play pre-launch report and fix crashes/ANRs, broken authentication, unreachable services and unsupported-screen issues. Test supported Android versions, large text, RTL, denied permissions and offline recovery. |

Suggested Data safety inventory to confirm, **not an automatically completed form**:
account identifiers/name/email/phone; optional precise/coarse service location; public
reviews/listings and private request messages; selected verification files/images;
push/device identifiers; and diagnostics when Sentry is enabled. There is no in-app
payment or advertising SDK in the inspected implementation; confirm this remains true
for the final build and business model. Quotes alone should not be presented as an
implemented payment service.

Official references to revisit when accessible:

- [User data/privacy](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111)
- [User-generated content](https://support.google.com/googleplay/android-developer/answer/9876937)
- [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465)
- [16 KB page sizes](https://developer.android.com/guide/practices/page-sizes)
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)

## Earlier validation reminders to retain

- Real password-reset emails/SMTP, auth redirect allowlists, expired/reused links,
  secure password-change policy, and installed Android/iPhone cold/warm deep links.
- Physical **Android release-build** map gestures, spring interruption/reversal, all
  three detents, nested scrolling/footer dragging, selected-marker camera padding,
  controls versus cards/safe areas/keyboard, low-zoom crowding, tile/offline recovery,
  and dropped-frame/JS/UI profiling. Browser and Expo Go results do not certify these.
- iPhone/Android keyboard/focus, VoiceOver/TalkBack, large fonts, Arabic/RTL, reduced
  motion, permission denial and small screens, including the new account/safety flows.
- Live customer/provider transaction rules, duplicate/conflicting updates, hosted RLS,
  listing lifecycle, notifications and external backend deployment checks.

See `PRODUCTION_READINESS.md` for the earlier evidence and complete remaining work.

## Verification evidence for this branch

Final results are recorded in `PRODUCTION_READINESS.md`. Release configuration is
expected to fail until the deferred contact/retention/URLs, real backend settings,
and Firebase file are supplied. No Play upload, AAB build, native device certification,
real account deletion, hosted SQL test, or backend deployment is claimed.
