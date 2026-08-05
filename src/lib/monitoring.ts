import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() || undefined;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  enableAutoSessionTracking: true,
  enableNative: Platform.OS !== 'web',
  environment: __DEV__ ? 'development' : 'production',
  sendDefaultPii: false,
  tracesSampleRate: __DEV__ ? 0 : 0.1,
});

export function syncMonitoringUser(userId: string | null | undefined) {
  Sentry.setUser(userId ? { id: userId } : null);
}

export { Sentry };
