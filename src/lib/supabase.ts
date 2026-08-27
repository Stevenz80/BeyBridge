import 'react-native-url-polyfill/auto';
import 'expo-sqlite/localStorage/install';

import { AppState, Platform } from 'react-native';
import { createClient, processLock } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

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
      detectSessionInUrl: Platform.OS === 'web',
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
