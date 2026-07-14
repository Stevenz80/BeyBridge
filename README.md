# BeyBridge 🌉

*Your link to the heart of Beirut's services.*

A mobile-first MVP built with **React Native + Expo** (Expo Router, TypeScript). This first build covers the core loop with mock data: **search → results → details → contact**.

## How to run this (10 minutes)

You need Node.js installed, and the **Expo Go** app on your phone (App Store / Play Store).

**1. Create a fresh Expo project:**

```bash
npx create-expo-app@latest beybridge
cd beybridge
```

**2. Reset the starter to a blank template** (Expo ships demo screens we don't want):

```bash
npm run reset-project
# answer "y" to delete the example files, or move them — either is fine
```

**3. Copy this bundle's folders into the project, replacing what's there:**

- `app/` → replaces the project's `app/`
- `components/`, `constants/`, `lib/` → copy into the project root

**4. Start it:**

```bash
npx expo start
```

Scan the QR code with your phone's camera (iOS) or the Expo Go app (Android). The app loads on your phone and hot-reloads every time you save a file.

> Web preview works too: press `w` in the terminal, or run `npx expo start --web`. Same codebase — this is your future website path.

## What's in this build

| Screen | File | Status |
|---|---|---|
| Home (hero, search, categories, top rated) | `app/(tabs)/index.tsx` | ✅ working |
| Search results + filters | `app/search.tsx` | ✅ working (mock data) |
| Provider details + Call/WhatsApp/Directions | `app/provider/[id].tsx` | ✅ working |
| Favorites | `app/(tabs)/favorites.tsx` | 🔜 placeholder (needs auth) |
| Profile / Auth | `app/(tabs)/profile.tsx` | 🔜 placeholder (needs auth) |

## How the pieces fit

```
app/            Screens. Each file = one route (Expo Router).
  _layout.tsx   Root stack: tabs + pushed screens (search, provider/[id])
  (tabs)/       Bottom tab bar: Home, Favorites, Profile
components/     Reusable UI: SearchBar, CategoryCard, ProviderCard
constants/      theme.ts — all colors/spacing/type in one place
lib/            types.ts (mirrors future DB schema) + mockData.ts
```

**The key architectural idea:** `lib/types.ts` mirrors the Supabase schema exactly. Screens only know about those types — they don't care whether data comes from `mockData.ts` or a database. In the backend step, we delete `mockData.ts`, add `lib/supabase.ts`, and the screens barely change.

## Next steps (in order)

1. Run it, click around, tweak colors/copy until it feels right
2. Create the Supabase project + run the schema SQL
3. Replace mock data with Supabase queries (`useEffect` + loading states)
4. Add auth (login/signup) → unlock Favorites
5. Reviews + "Add a place" form + admin approval
