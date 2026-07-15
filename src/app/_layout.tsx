import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../constants/theme';
import { AuthProvider } from '../providers/AuthProvider';
import { MarketplaceProvider } from '../providers/MarketplaceProvider';

SplashScreen.setOptions({ duration: 450, fade: true });

export default function RootLayout() {
  return (
    <AuthProvider>
      <MarketplaceProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: Colors.surface },
            headerShadowVisible: false,
            headerTintColor: Colors.primary,
            headerTitleStyle: { color: Colors.text, fontWeight: '800' },
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="search" options={{ title: 'Find a service' }} />
          <Stack.Screen name="provider/[id]" options={{ title: 'Service details' }} />
        </Stack>
      </MarketplaceProvider>
    </AuthProvider>
  );
}
