import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { isSupabaseConfigured, supabase } from './supabase';

const STORED_PUSH_TOKEN_KEY = 'beybridge.expoPushToken';
const ANDROID_CHANNEL_ID = 'account-updates';

export type PushRegistrationResult = {
  error: string | null;
  token: string | null;
};

function getProjectId() {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export function getPushRegistrationUnavailableReason() {
  if (Platform.OS === 'web') {
    return 'Push alerts are available in the installed Android or iOS app.';
  }
  if (!getProjectId()) {
    return 'Remote push delivery is not connected yet. Your account updates still appear here.';
  }
  return null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function getStoredPushToken() {
  try {
    return localStorage.getItem(STORED_PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storePushToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORED_PUSH_TOKEN_KEY, token);
    else localStorage.removeItem(STORED_PUSH_TOKEN_KEY);
  } catch {
    // Registration remains valid even when device storage is temporarily unavailable.
  }
}

export async function configureForegroundNotificationBehavior() {
  if (Platform.OS === 'web') return;

  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerCurrentDeviceForPush(): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') {
    return {
      error: 'Push alerts are available in the installed Android or iOS app.',
      token: null,
    };
  }

  if (!Device.isDevice) {
    return {
      error: 'Use a physical device to enable push alerts.',
      token: null,
    };
  }

  if (!isSupabaseConfigured) {
    return { error: 'Connect Supabase before enabling push alerts.', token: null };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return {
      error: 'Link this app to an EAS project before enabling remote push alerts.',
      token: null,
    };
  }

  try {
    const Notifications = await import('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Account updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7E5BEF',
      });
    }

    const existingPermission = await Notifications.getPermissionsAsync();
    const finalPermission =
      existingPermission.status === 'granted'
        ? existingPermission
        : await Notifications.requestPermissionsAsync();

    if (finalPermission.status !== 'granted') {
      return {
        error: 'Notification permission was not granted. You can enable it in device settings.',
        token: null,
      };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await supabase.rpc('register_push_token', {
      p_expo_push_token: token,
      p_platform: Platform.OS,
      p_device_name: Device.deviceName ?? '',
      p_app_version: Constants.expoConfig?.version ?? '',
    });

    if (error) return { error: error.message, token: null };

    storePushToken(token);
    return { error: null, token };
  } catch (error) {
    const message = getErrorMessage(error, 'Push alerts could not be enabled.');
    const expoGoHint = message.toLowerCase().includes('expo go')
      ? ' Remote push alerts on Android require a development build, not Expo Go.'
      : '';
    return { error: `${message}${expoGoHint}`.trim(), token: null };
  }
}

export async function unregisterCurrentDeviceFromPush(): Promise<{ error: string | null }> {
  const token = getStoredPushToken();
  if (!token) return { error: null };

  if (!isSupabaseConfigured) {
    storePushToken(null);
    return { error: null };
  }

  const { error } = await supabase.rpc('unregister_push_token', {
    p_expo_push_token: token,
  });

  if (error) return { error: error.message };

  storePushToken(null);
  return { error: null };
}

export function getSafeNotificationRoute(value: unknown) {
  if (typeof value !== 'string') return null;
  if (value === '/notifications' || value === '/provider/verification' || value === '/business') {
    return value;
  }
  if (/^\/request\/[0-9a-f-]{36}$/i.test(value)) return value;
  return null;
}
