import { useEffect } from 'react';
import { Stack, type Href, useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../constants/theme';
import {
  configureForegroundNotificationBehavior,
  getSafeNotificationRoute,
} from '../lib/notifications';
import { AuthProvider } from '../providers/AuthProvider';
import { MarketplaceProvider } from '../providers/MarketplaceProvider';
import { NotificationProvider } from '../providers/NotificationProvider';
import { ServiceRequestProvider } from '../providers/ServiceRequestProvider';
import { TrustProvider } from '../providers/TrustProvider';

SplashScreen.setOptions({ duration: 450, fade: true });

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MarketplaceProvider>
          <ServiceRequestProvider>
            <TrustProvider>
              <NotificationRuntime />
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
                <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
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
      </NotificationProvider>
    </AuthProvider>
  );
}

function NotificationRuntime() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let active = true;
    let subscription: { remove: () => void } | undefined;

    const openNotificationRoute = (value: unknown) => {
      const route = getSafeNotificationRoute(value);
      if (route) router.push(route as Href);
    };

    void configureForegroundNotificationBehavior().catch(() => undefined);
    void import('expo-notifications').then(async (Notifications) => {
      if (!active) return;
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        openNotificationRoute(response.notification.request.content.data?.url);
      });

      const response = await Notifications.getLastNotificationResponseAsync();
      if (active && response) {
        openNotificationRoute(response.notification.request.content.data?.url);
        await Notifications.clearLastNotificationResponseAsync();
      }
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [router]);

  return null;
}
