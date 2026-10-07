import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { AppState, Platform } from 'react-native';
import { AuthClient, createClient, processLock } from '@supabase/supabase-js';
import { isPasswordRecoveryUrl } from './auth';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

let recoveryClientSequence = 0;

export function createRecoveryAuthClient() {
  // An update must use the email-link credentials, even if another account
  // signs in while it is pending. Never let its USER_UPDATED event write
  // back into the app's shared session storage or BroadcastChannel.
  return new AuthClient({
    url: `${supabaseUrl?.replace(/\/$/, '')}/auth/v1`,
    headers: { apikey: supabasePublishableKey!, Authorization: `Bearer ${supabasePublishableKey}` },
    storageKey: `beybridge-password-recovery-${++recoveryClientSequence}`,
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    lock: processLock,
  });
}

// Valid fallbacks let the UI render its setup instructions before credentials
// exist. Auth methods are disabled while `isSupabaseConfigured` is false.
export const supabase = createClient(
  supabaseUrl || 'https://not-configured.supabase.co',
  supabasePublishableKey || 'not-configured',
  {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Recovery links have one owner so startup cannot consume a code twice
      // or confuse an existing ordinary session with the email-link session.
      detectSessionInUrl: Platform.OS === 'web' && !isPasswordRecoveryUrl(globalThis.location.href),
      lock: processLock,
    },
  }
);

if (Platform.OS !== 'web' && isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
