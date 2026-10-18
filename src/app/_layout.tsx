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
import { SafetyProvider } from '../providers/SafetyProvider';
import { syncMonitoringUser } from '../lib/monitoring';
import { AppErrorBoundary } from '../components/app-error-boundary';

export const ErrorBoundary = AppErrorBoundary;

if (!isRunningInExpoGo()) {
  SplashScreen.setOptions({ duration: 450, fade: true });
}
// Keep the splash up until the stored session is known, so signed-out launches
// open straight on sign-in instead of flashing the home screen.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <AuthProvider>
          <MonitoringIdentity />
          <NotificationProvider>
            <SafetyProvider>
              <MarketplaceProvider>
                <LocalizationProvider>
                  <LocalizedAppTree />
                </LocalizationProvider>
              </MarketplaceProvider>
            </SafetyProvider>
          </NotificationProvider>
        </AuthProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function LocalizedAppTree() {
  const { direction, t } = useLocalization();
  const { configured, loading, user } = useAuth();
  // Configured builds require an account for everything except sign-in, password
  // recovery and the public legal/deletion pages. Builds without a backend have
  // nothing to sign into, so they keep anonymous browsing. While the stored
  // session loads (behind the splash screen) the app stays mounted so a
  // signed-in launch does not bounce through sign-in.
  const appAvailable = !configured || loading || Boolean(user);

  return (
    <View style={{ flex: 1, direction }}>
      <ServiceRequestProvider>
        <TrustProvider>
          <NotificationRuntime />
          <PasswordRecoveryNavigation />
          <SplashScreenGate ready={!loading} />
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
            <Stack.Protected guard={appAvailable}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="notifications" options={{ title: t('Notifications') }} />
              <Stack.Screen name="search" options={{ title: t('Find a service') }} />
              <Stack.Screen name="map" options={{ headerShown: false }} />
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
              <Stack.Screen name="account/blocked-users" options={{ title: t('Blocked users') }} />
              <Stack.Screen name="admin/index" options={{ title: t('Administration') }} />
              <Stack.Screen
                name="admin/verification/[id]"
                options={{ title: t('Verification review') }}
              />
              <Stack.Screen name="admin/report/[id]" options={{ title: t('Review report') }} />
            </Stack.Protected>
            {/* Declared before the public screens: a signed-out visitor is redirected
                to the first available screen. */}
            <Stack.Protected guard={!appAvailable}>
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="auth/forgot-password" options={{ title: t('Reset password') }} />
            <Stack.Screen name="auth/reset-password" options={{ title: t('Reset password') }} />
            <Stack.Screen name="account/delete" options={{ title: t('Delete account') }} />
            <Stack.Screen name="legal/[document]" options={{ title: t('Privacy and terms') }} />
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

// Auth can take ~25 s on a bad network while it retries a token refresh, so the
// splash is capped; screens have their own loading states after that.
const SPLASH_MAX_MS = 3000;

function SplashScreenGate({ ready }: { ready: boolean }) {
  useEffect(() => {
    if (ready) {
      SplashScreen.hide();
      return;
    }
    const timeout = setTimeout(() => SplashScreen.hide(), SPLASH_MAX_MS);
    return () => clearTimeout(timeout);
  }, [ready]);
  return null;
}

function PasswordRecoveryNavigation() {
  const router = useRouter();
  const { passwordRecovery } = useAuth();
  useEffect(() => {
    if (passwordRecovery.status === 'verifying' || passwordRecovery.status === 'ready') {
      router.replace('/auth/reset-password');
    }
  }, [passwordRecovery.attempt, passwordRecovery.status, router]);
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
    }).catch(() => undefined);

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [router]);

  return null;
}
