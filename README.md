# BeyBridge

*Your link to the heart of Beirut's services.*

BeyBridge is a mobile-first local-services marketplace built with React Native, Expo Router, TypeScript, and Supabase. Customers can discover providers, save services, publish reviews, and track service requests. Providers have a separate business workspace for listings, requests, and verification. Platform administrators can review trust-and-safety queues.

## Run the app

Use an active Node.js LTS release and install dependencies:

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

The Android application ID is configured as `com.beybridge.app`, so Expo can open or export the Android app without the missing `android.package` error.

## Environment variables

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Only use the Supabase publishable key in the app. Never place the service-role key in an `EXPO_PUBLIC_` variable or commit `.env.local`.

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
- append-only listing suspension and restoration actions.

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
| Customer discovery | Home, categories, search, provider details, call, WhatsApp, directions |
| Customer account | Sign up, sign in, persisted session, editable profile, favorites, reviews |
| Service requests | Request form, customer tracking, provider inbox, guarded status actions, audit timeline |
| Provider workspace | Provider account mode, listing create/edit/publish/pause/delete, performance summary |
| Trust and safety | Verification requests and private evidence documents, service/review reports, administrator queues, suspension/restoration |

## Validation

Run the local app checks:

```bash
npx tsc --noEmit
npm run lint
npx expo-doctor
npx expo export --platform android
```

Run the rollback-safe tests against the linked project:

```bash
npx supabase db query --linked --file supabase/tests/service_request_workflow.sql
npx supabase db query --linked --file supabase/tests/trust_and_admin_workflow.sql
npx supabase db query --linked --file supabase/tests/catalog_and_storage_configuration.sql
npx supabase db lint --linked --schema public --level warning --fail-on error
```

All SQL tests finish with `rollback`, so they do not leave test accounts, requests, reports, or moderation actions in the project.

## Structure

```text
src/app/          Expo Router screens and route groups
src/components/   Reusable forms, cards, and account UI
src/constants/    Shared visual design tokens
src/lib/          Supabase client, shared types, and curated directory data
src/providers/    Auth, marketplace, service-request, and trust state
supabase/         Versioned migrations and rollback-safe workflow tests
```

## Remaining roadmap

The curated catalog and private verification-document milestone are complete. The next priorities are push notifications for request/status changes, stronger search and map discovery, provider analytics, and automated end-to-end device tests. Remote push notifications require a development build and Expo/Apple/Google notification credentials; they do not work in Expo Go on Android.
