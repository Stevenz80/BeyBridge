import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../constants/theme';
import { AuthProvider } from '../providers/AuthProvider';
import { MarketplaceProvider } from '../providers/MarketplaceProvider';
import { ServiceRequestProvider } from '../providers/ServiceRequestProvider';
import { TrustProvider } from '../providers/TrustProvider';

SplashScreen.setOptions({ duration: 450, fade: true });

export default function RootLayout() {
  return (
    <AuthProvider>
      <MarketplaceProvider>
        <ServiceRequestProvider>
          <TrustProvider>
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
              <Stack.Screen
                name="provider/manage"
                options={{ title: 'Service listing', presentation: 'modal' }}
              />
              <Stack.Screen
                name="provider/verification"
                options={{ title: 'Provider verification', presentation: 'modal' }}
              />
              <Stack.Screen
                name="report/new"
                options={{ title: 'Report content', presentation: 'modal' }}
              />
              <Stack.Screen
                name="request/new"
                options={{ title: 'Request service', presentation: 'modal' }}
              />
              <Stack.Screen name="request/[id]" options={{ title: 'Request details' }} />
              <Stack.Screen name="provider/[id]" options={{ title: 'Service details' }} />
              <Stack.Screen name="admin/index" options={{ title: 'Administration' }} />
              <Stack.Screen
                name="admin/verification/[id]"
                options={{ title: 'Verification review' }}
              />
              <Stack.Screen name="admin/report/[id]" options={{ title: 'Report review' }} />
            </Stack>
          </TrustProvider>
        </ServiceRequestProvider>
      </MarketplaceProvider>
    </AuthProvider>
  );
}
