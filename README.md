# BeyBridge

*Your link to the heart of Beirut's services.*

BeyBridge is a mobile-first local-services marketplace built with React Native, Expo Router, TypeScript, and Supabase. Customers can discover providers, save services, publish reviews, and track service requests. Providers have a separate business workspace for listings, requests, and verification. Platform administrators can review trust-and-safety queues.

## Run the app

Use Node.js 22 or 24 LTS (the repository includes an `.nvmrc`) and install dependencies. Avoid Node 26 for this SDK 57 project because its localhost and tunnel behavior can prevent Expo Go from reaching Metro:

```bash
npm install
```

Copy the environment template, add the values from **Supabase Dashboard → Connect**, and restart Expo:

```powershell
Copy-Item .env.example .env.local
npx expo start
```

Scan the QR code with Expo Go on an Android or iOS phone connected to the same network. If local-network discovery is blocked, use:

```bash
npx expo start --tunnel
```

For remote push notifications and release-level native testing, use the configured development-client profile after linking the app to an EAS project:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile development
npx expo start --dev-client
```

EAS cloud builds consume plan build minutes. The `development` and `preview` Android profiles produce installable APKs; `production` is reserved for signed store builds.

The Android application ID is configured as `com.beybridge.app`, so Expo can open or export the Android app without the missing `android.package` error.

## Environment variables

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_SENTRY_DSN=
```

Only use the Supabase publishable key in the app. Never place the service-role key in an `EXPO_PUBLIC_` variable or commit `.env.local`.

`EXPO_PUBLIC_SENTRY_DSN` is optional. When it is empty, monitoring is disabled and the app does not send events.

### Configure social sign-in

The account screen currently exposes email/password and Google sign-in. Phone OTP and Sign in with Apple remain staged in the code but hidden until their paid external services are approved. The client code does not contain provider secrets; finish Google setup in **Supabase Dashboard → Authentication**:

1. Under **URL Configuration**, add `beybridge://**` to the redirect allow list. Add the deployed web origin as well if the web build will be published.
2. Under **Providers → Google**, add a Google OAuth web client ID and secret. Register `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as that client's authorized redirect URI in Google Cloud.

Apple calls its iCloud-backed option **Sign in with Apple** and requires an Apple Developer Program membership for production configuration. Keep OAuth credentials in Supabase or the provider consoles, never in `EXPO_PUBLIC_` variables.

## Apply the Supabase schema

The repository contains versioned migrations with explicit grants, Row Level Security policies, guarded state transitions, and audit history.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --linked
```

Current database-backed workflows include:

- authenticated profiles and customer/provider account types;
- provider-owned draft, published, and paused listings;
- favorites and one editable review per customer/provider pair;
- customer service requests with a guarded status timeline;
- provider verification submissions and administrator decisions;
- private provider-verification documents with owner/admin-only Storage policies;
- private provider/review reports;
- append-only listing suspension and restoration actions;
- private account notifications generated from request, verification, report, and moderation events;
- device push-token registration with per-user RLS;
- a private push-delivery outbox with Expo ticket/receipt reconciliation and retry handling;
- private 30-day provider performance analytics;
- validated provider coordinates for nearby discovery.

### Assign the first administrator

Administrator access is deliberately not assigned by a public app action. After the account has signed up, copy its user UUID from **Supabase Dashboard → Authentication → Users**, then run this in the SQL Editor with a trusted database role:

```sql
insert into public.platform_admins (user_id, note)
values ('YOUR_AUTH_USER_UUID', 'Initial administrator');
```

Sign out and sign back in, then open **Profile → Administrator dashboard**. Never expose this insert through an unprotected client screen or use a service-role key in the mobile app.

## Product areas

| Area | Capabilities |
|---|---|
| Customer discovery | Home, categories, text/rating/distance search, native provider map, near-me radius filters, provider details, call, WhatsApp, directions |
| Customer account | Sign up, sign in, persisted session, editable profile, favorites, reviews, account notification center |
| Service requests | Request form, customer tracking, provider inbox, guarded status actions, audit timeline |
| Provider workspace | Provider account mode, listing create/edit/publish/pause/delete, map location, private 30-day performance analytics |
| Trust and safety | Verification requests and private evidence documents, service/review reports, administrator queues, suspension/restoration |

## Validation

Run the local app checks:

```bash
npx tsc --noEmit
npm run lint
npx expo-doctor
npx expo export --platform android
```

Run the read-only mobile-web smoke journeys. The test lifecycle first exports an unconfigured static build, then serves that deterministic production artifact:

```bash
npx playwright install chromium
npm run test:e2e:web
```

If the Playwright browser download is unavailable but Chrome is already installed, set `PLAYWRIGHT_BROWSER_PATH` to the Chrome executable before running the test command.

The browser suite covers anonymous discovery, search, account entry, and protected-route guards. It starts Expo in the app's unconfigured demo mode, so it never reads or modifies records in the connected Supabase project. Authenticated customer, provider, and administrator mutation journeys should use dedicated test accounts in a separate test project.

### Configure production monitoring

Runtime Sentry monitoring is already wired into the app. Metro automatically adds Sentry debug IDs and source maps when `SENTRY_ORG` and `SENTRY_PROJECT` are present in the build environment. Create a Sentry React Native project, then configure these values in the EAS environment used by the build:

```dotenv
EXPO_PUBLIC_SENTRY_DSN=https://PUBLIC_DSN_VALUE
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=your-sensitive-source-map-token
```

Keep `SENTRY_AUTH_TOKEN` sensitive and out of `.env.local` and Git. After credentials are configured, create a release build and verify one controlled test error reaches Sentry with a symbolicated stack trace.

### Map builds

The provider map uses MapLibre Native with OpenFreeMap's hosted OpenStreetMap-based tiles. It does not require a Google Cloud project, API key, billing account, or credit card. MapLibre is native code and is not included in Expo Go, so Expo Go shows the accessible location browser while development and production builds show the interactive map.

After installing or updating native dependencies, create and install a fresh development build:

```bash
npx eas-cli build --platform android --profile development
npx expo start --dev-client --lan --port 8082 --clear
```

Open the installed BeyBridge development client rather than Expo Go. OpenFreeMap attribution is displayed automatically on the map.

Run the rollback-safe tests against the linked project:

```bash
npx supabase db query --linked --file supabase/tests/service_request_workflow.sql
npx supabase db query --linked --file supabase/tests/trust_and_admin_workflow.sql
npx supabase db query --linked --file supabase/tests/catalog_and_storage_configuration.sql
npx supabase db query --linked --file supabase/tests/account_notifications.sql
npx supabase db query --linked --file supabase/tests/provider_analytics.sql
npx supabase db lint --linked --schema public --level warning --fail-on error
```

All SQL tests finish with `rollback`, so they do not leave test accounts, requests, reports, or moderation actions in the project.

### Deploy the push worker

The Edge Function is server-only. Deploy it without gateway JWT verification because it authenticates a scheduled database request with a separate 32+ character secret:

```bash
npx supabase functions deploy process-push-notifications --use-api --no-verify-jwt
npx supabase secrets set PUSH_DISPATCH_SECRET=YOUR_URL_SAFE_RANDOM_SECRET
```

The same worker also sends provider-verification submissions to the administrator. The database
always keeps the request in the in-app admin queue and creates a retryable email outbox entry. Set
the recipient now and add a server-only [Resend](https://resend.com/) API key before expecting email
delivery:

```bash
npx supabase secrets set VERIFICATION_ADMIN_EMAIL=stevenoueiss11@gmail.com
npx supabase secrets set RESEND_API_KEY=re_YOUR_SERVER_ONLY_KEY
# Optional after verifying a BeyBridge sending domain with Resend:
npx supabase secrets set "VERIFICATION_FROM_EMAIL=BeyBridge <notifications@beybridge.example>"
```

`onboarding@resend.dev` is used as the temporary sender when `VERIFICATION_FROM_EMAIL` is absent.
Resend's testing sender can only deliver to the email address associated with the Resend account;
verify a BeyBridge domain before sending to arbitrary administrator addresses. Never place any of
these values in an `EXPO_PUBLIC_` variable.

The initial in-app administrator allowlist contains the existing BeyBridge login
`stevenoueiss10@gmail.com` and the future test-admin login `stevenoueiss11@gmail.com`. The worker's
email recipient is configured separately, so administrator mail currently goes only to
`stevenoueiss11@gmail.com`.

Store the same value in Vault and create the minute scheduler with the locked deployment helper:

```sql
select private.configure_push_worker(
  'https://YOUR_PROJECT_REF.supabase.co',
  'YOUR_URL_SAFE_RANDOM_SECRET'
);
```

The worker claims at most 100 notifications per run, retries temporary Expo API failures, checks receipts after 15 minutes, and disables registrations reported as `DeviceNotRegistered`. Never place the dispatch secret or a Supabase secret/service-role key in an `EXPO_PUBLIC_` variable.

### Configure Android push notifications

Android remote notifications require Firebase Cloud Messaging and an installed development build.
Register the Android app `com.beybridge.app` in the Firebase project, download its
`google-services.json`, and place it at the repository root. The file is intentionally ignored by
Git and is referenced by `expo.android.googleServicesFile` in `app.json`.

Then rebuild and reinstall the native app; restarting Metro alone does not update Firebase native
configuration:

```bash
npx expo run:android --device
npx expo start --dev-client --lan --port 8082 --clear
```

For EAS builds, also upload the FCM V1 service-account credential under the Android application
identifier in Expo credentials. The service-account file is a different, sensitive JSON file and
must never be committed.

## Structure

```text
src/app/          Expo Router screens and route groups
src/components/   Reusable forms, cards, and account UI
src/constants/    Shared visual design tokens
src/lib/          Supabase client, shared types, and curated directory data
src/providers/    Auth, marketplace, service-request, and trust state
supabase/         Versioned migrations and rollback-safe workflow tests
```

## Remaining production prerequisites

The in-app notification center, push delivery worker, nearby discovery, native provider map, provider analytics, anonymous mobile-web journeys, and repository-side Sentry integration are complete. What remains requires external accounts, credentials, or hardware:

- sign in to EAS, link this repository to an Expo project, and configure Apple/Google push credentials;
- activate Firebase for the existing Google Cloud project, add the Android app, and download its `google-services.json`;
- create a Resend API key and verify a BeyBridge sending domain for administrator email delivery;
- create a Sentry organization/project and configure the DSN, organization slug, project slug, and sensitive source-map token;
- upgrade the Supabase project to Pro or above, then enable leaked-password protection under **Authentication → Settings** (Supabase rejects this setting with HTTP 402 on the current plan);
- create signed development/production builds and complete authenticated customer, provider, and administrator journeys on real devices.

Remote push notifications require a development build and notification credentials; they do not work in Expo Go on Android. In-app notifications work independently of that setup.
