import { useEffect } from 'react';
import { Stack, type Href, useRouter } from 'expo-router';
import { isRunningInExpoGo } from 'expo';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Colors } from '../constants/theme';
import {
  configureForegroundNotificationBehavior,
  getSafeNotificationRoute,
  isNativeNotificationRuntimeAvailable,
} from '../lib/notifications';
import { AuthProvider, useAuth } from '../providers/AuthProvider';
import { MarketplaceProvider } from '../providers/MarketplaceProvider';
import { LocalizationProvider, useLocalization } from '../providers/LocalizationProvider';
import { NotificationProvider } from '../providers/NotificationProvider';
import { ServiceRequestProvider } from '../providers/ServiceRequestProvider';
import { TrustProvider } from '../providers/TrustProvider';
import { syncMonitoringUser } from '../lib/monitoring';

if (!isRunningInExpoGo()) {
  SplashScreen.setOptions({ duration: 450, fade: true });
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AuthProvider>
          <MonitoringIdentity />
          <NotificationProvider>
            <MarketplaceProvider>
              <LocalizationProvider>
                <LocalizedAppTree />
              </LocalizationProvider>
            </MarketplaceProvider>
          </NotificationProvider>
        </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function LocalizedAppTree() {
  const { direction, t } = useLocalization();

  return (
    <View style={{ flex: 1, direction }}>
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
            <Stack.Screen name="notifications" options={{ title: t('Notifications') }} />
            <Stack.Screen name="search" options={{ title: t('Find a service') }} />
            <Stack.Screen name="map" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen
              name="provider/manage"
              options={{ title: t('Service listing'), presentation: 'modal' }}
            />
            <Stack.Screen
              name="provider/verification"
              options={{ title: t('Provider verification'), presentation: 'modal' }}
            />
            <Stack.Screen
              name="report/new"
              options={{ title: t('Report content'), presentation: 'modal' }}
            />
            <Stack.Screen
              name="request/new"
              options={{ title: t('Request service'), presentation: 'modal' }}
            />
            <Stack.Screen name="request/[id]" options={{ title: t('Request details') }} />
            <Stack.Screen name="provider/[id]" options={{ title: t('Service details') }} />
            <Stack.Screen name="profile/reviews" options={{ title: t('Your reviews') }} />
            <Stack.Screen name="admin/index" options={{ title: t('Administration') }} />
            <Stack.Screen
              name="admin/verification/[id]"
              options={{ title: t('Verification review') }}
            />
            <Stack.Screen name="admin/report/[id]" options={{ title: t('Review report') }} />
          </Stack>
        </TrustProvider>
      </ServiceRequestProvider>
    </View>
  );
}

function MonitoringIdentity() {
  const { user } = useAuth();

  useEffect(() => {
    syncMonitoringUser(user?.id);
  }, [user?.id]);

  return null;
}

function NotificationRuntime() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeNotificationRuntimeAvailable()) return;

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
