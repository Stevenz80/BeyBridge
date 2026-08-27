import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { parseAuthCallbackUrl } from '../lib/auth';
import { unregisterCurrentDeviceFromPush } from '../lib/notifications';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthResult = {
  error: { message: string } | null;
  needsEmailConfirmation?: boolean;
  cancelled?: boolean;
};

type AccountType = 'customer' | 'provider';
type SocialProvider = 'google' | 'apple';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    accountType: AccountType
  ) => Promise<AuthResult>;
  sendPhoneOtp: (
    phone: string,
    mode: 'signIn' | 'signUp',
    fullName: string,
    accountType: AccountType
  ) => Promise<AuthResult>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<AuthResult>;
  signInWithSocial: (provider: SocialProvider) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const nativeOAuthRedirectUrl = 'beybridge://auth/callback';

function authError(error: unknown): { message: string } {
  return {
    message: error instanceof Error ? error.message : 'Authentication could not be completed.',
  };
}

async function completeNativeOAuth(url: string): Promise<AuthResult> {
  try {
    const callback = parseAuthCallbackUrl(url);
    if (callback.errorMessage) return { error: { message: callback.errorMessage } };

    if (callback.authorizationCode) {
      const { error } = await supabase.auth.exchangeCodeForSession(callback.authorizationCode);
      return { error };
    }

    if (!callback.accessToken || !callback.refreshToken) {
      return { error: { message: 'The identity provider did not return a valid session.' } };
    }

    const { error } = await supabase.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });
    return { error };
  } catch (error: unknown) {
    return { error: authError(error) };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      signIn: async (email, password) => {
        if (!isSupabaseConfigured) return { error: null };

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      },
      signUp: async (email, password, fullName, accountType) => {
        if (!isSupabaseConfigured) return { error: null };

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim(), account_type: accountType } },
        });

        return { error, needsEmailConfirmation: !error && !data.session };
      },
      sendPhoneOtp: async (phone, mode, fullName, accountType) => {
        if (!isSupabaseConfigured) return { error: null };

        const { error } = await supabase.auth.signInWithOtp({
          phone,
          options: {
            shouldCreateUser: mode === 'signUp',
            data:
              mode === 'signUp'
                ? { full_name: fullName.trim(), account_type: accountType }
                : undefined,
          },
        });
        return { error };
      },
      verifyPhoneOtp: async (phone, token) => {
        if (!isSupabaseConfigured) return { error: null };

        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        return { error };
      },
      signInWithSocial: async (provider) => {
        if (!isSupabaseConfigured) return { error: null };

        const redirectTo =
          Platform.OS === 'web' ? Linking.createURL('auth/callback') : nativeOAuthRedirectUrl;
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo,
            skipBrowserRedirect: Platform.OS !== 'web',
          },
        });

        if (error || Platform.OS === 'web') return { error };
        if (!data.url) return { error: { message: 'The sign-in page could not be opened.' } };

        try {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (result.type !== 'success') return { error: null, cancelled: true };
          return completeNativeOAuth(result.url);
        } catch (oauthError: unknown) {
          return { error: authError(oauthError) };
        }
      },
      signOut: async () => {
        if (!isSupabaseConfigured) return { error: null };

        const pushCleanup = await unregisterCurrentDeviceFromPush({ preservePreference: true });
        if (pushCleanup.error) {
          return {
            error: {
              message: `Push alerts could not be disconnected from this device. ${pushCleanup.error}`,
            },
          };
        }

        const { error } = await supabase.auth.signOut();
        return { error };
      },
    }),
    [loading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
