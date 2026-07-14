// app/_layout.tsx
// The ROOT of the app. With Expo Router, every file inside /app
// automatically becomes a screen, and _layout.tsx files define how
// those screens are wrapped (stack, tabs, headers...).
//
// Structure:
//   Stack
//   ├── (tabs)        → the bottom tab bar (Home / Favorites / Profile)
//   ├── search        → results screen, pushed on top of tabs
//   └── provider/[id] → details screen, pushed on top of results

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.navy },
          headerTintColor: Colors.textOnDark,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        {/* The tab navigator hides the stack header — tabs manage their own */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ title: 'Results' }} />
        <Stack.Screen name="provider/[id]" options={{ title: '' }} />
      </Stack>
    </>
  );
}
