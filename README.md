# BeyBridge 🌉

*Your link to the heart of Beirut's services.*

A mobile-first MVP built with **React Native + Expo** (Expo Router, TypeScript) and **Supabase Auth**. The service directory still uses local mock data while accounts use a real persisted Supabase session.

## Run locally

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npx expo start
```

Scan the QR code with Expo Go or use an Android/iOS simulator.

> Web preview works too: press `w` in the terminal, or run `npx expo start --web`. Same codebase — this is your future website path.

## What's in this build

| Screen | File | Status |
|---|---|---|
| Home (hero, search, categories, top rated) | `app/(tabs)/index.tsx` | ✅ working |
| Search results + filters | `app/search.tsx` | ✅ working (mock data) |
| Provider details + Call/WhatsApp/Directions | `app/provider/[id].tsx` | ✅ working |
| Favorites account gate | `app/(tabs)/favorites.tsx` | ✅ session-aware |
| Sign up / Sign in / Profile / Sign out | `app/(tabs)/profile.tsx` | ✅ Supabase Auth |

## Enable accounts

1. Create a Supabase project.
2. Open the project's **Connect** panel and copy the Project URL and publishable key.
3. Copy `.env.example` to `.env.local`.
4. Replace the placeholder values:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

5. Restart or fully reload Expo.

Use only the Supabase publishable key in the app. Never add a service-role key to an `EXPO_PUBLIC_` variable. If email confirmation is enabled in Supabase, new users must confirm their email before signing in.

## How the pieces fit

```
app/            Screens. Each file = one route (Expo Router).
  _layout.tsx   Root stack: tabs + pushed screens (search, provider/[id])
  (tabs)/       Bottom tab bar: Home, Favorites, Profile
components/     Reusable UI: SearchBar, CategoryCard, ProviderCard
constants/      theme.ts — all colors/spacing/type in one place
lib/            mock service data, shared types, and the Supabase client
providers/      AuthProvider.tsx — session and account actions
```

**The key architectural idea:** account state is centralized in `AuthProvider`, while service screens still consume the same provider types. Moving providers from mock data to database queries remains independent of authentication UI.

## Next steps (in order)

1. Connect a Supabase project and test sign-up/sign-in on a device
2. Add a `profiles` table and Row Level Security policies
3. Persist provider favorites per authenticated user
4. Replace provider mock data with Supabase queries
5. Add reviews and provider submissions with admin approval
