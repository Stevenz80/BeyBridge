import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { isPasswordRecoveryUrl, parseAuthCallbackUrl } from '../lib/auth';
import { unregisterCurrentDeviceFromPush } from '../lib/notifications';
import { createRecoveryAuthClient, isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthResult = {
  error: { message: string } | null;
  needsEmailConfirmation?: boolean;
  cancelled?: boolean;
};

type AccountType = 'customer' | 'provider';
type SocialProvider = 'google' | 'apple';

type PasswordRecoveryState = {
  status: 'idle' | 'verifying' | 'ready' | 'error' | 'complete';
  error: string | null;
  userId: string | null;
  attempt: number;
};
const RECOVERY_LINK_ERROR = 'This reset link is invalid or has expired. Request a new link to continue.';
const RECOVERY_CONNECTION_ERROR = 'Your reset link could not be checked. Check your connection and open the email link again.';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  passwordRecovery: PasswordRecoveryState;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  resetRecoveredPassword: (password: string) => Promise<AuthResult>;
  cancelPasswordRecovery: () => void;
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
  deleteAccount: () => Promise<AuthResult & { deleted?: boolean }>;
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
  const currentSession = useRef<Session | null>(null);
  const authEpoch = useRef(0);
  const deletingAccount = useRef(false);
  const recoverySequence = useRef(0);
  const recoveryGrant = useRef<{ userId: string; attempt: number } | null>(null);
  const lastRecoveryUrl = useRef<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState<PasswordRecoveryState>({
    status: 'idle', error: null, userId: null, attempt: 0,
  });
  const cancelPasswordRecovery = useCallback(() => {
    recoveryGrant.current = null;
    setPasswordRecovery({ status: 'idle', error: null, userId: null, attempt: ++recoverySequence.current });
  }, []);

  const completePasswordRecovery = useCallback(async (url: string) => {
    if (!isSupabaseConfigured || !isPasswordRecoveryUrl(url) || lastRecoveryUrl.current === url) return;
    lastRecoveryUrl.current = url;
    const attempt = ++recoverySequence.current;
    recoveryGrant.current = null;
    setPasswordRecovery({ status: 'verifying', error: null, userId: null, attempt });
    try {
      const callback = parseAuthCallbackUrl(url);
      // Remove email-link credentials from browser history before awaiting network I/O.
      if (Platform.OS === 'web') {
        const cleanUrl = new URL(url);
        cleanUrl.hash = '';
        cleanUrl.search = '';
        globalThis.history.replaceState(globalThis.history.state, '', cleanUrl.pathname);
      }
      if (callback.errorMessage || (!callback.authorizationCode &&
        (callback.type !== 'recovery' || !callback.accessToken || !callback.refreshToken))) {
        throw new Error(RECOVERY_LINK_ERROR);
      }
      const result = callback.authorizationCode
        ? await supabase.auth.exchangeCodeForSession(callback.authorizationCode)
        : await supabase.auth.setSession({ access_token: callback.accessToken!, refresh_token: callback.refreshToken! });
      if (attempt !== recoverySequence.current) return;
      const recovered = result.data.session;
      if (result.error && (result.error.status === 0 || (result.error.status ?? 0) >= 500)) {
        throw new Error(RECOVERY_CONNECTION_ERROR);
      }
      if (result.error || !recovered || currentSession.current?.access_token !== recovered.access_token) {
        throw new Error(RECOVERY_LINK_ERROR);
      }
      recoveryGrant.current = { userId: recovered.user.id, attempt };
      setPasswordRecovery({ status: 'ready', error: null, userId: recovered.user.id, attempt });
    } catch (error) {
      if (attempt === recoverySequence.current) {
        const message = error instanceof Error && error.message === RECOVERY_CONNECTION_ERROR
          ? RECOVERY_CONNECTION_ERROR : RECOVERY_LINK_ERROR;
        if (message === RECOVERY_CONNECTION_ERROR) lastRecoveryUrl.current = null;
        setPasswordRecovery({ status: 'error', error: message, userId: null, attempt });
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        currentSession.current = data.session;
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') authEpoch.current++;
      currentSession.current = nextSession;
      if (event === 'PASSWORD_RECOVERY' && nextSession) {
        const attempt = ++recoverySequence.current;
        recoveryGrant.current = { userId: nextSession.user.id, attempt };
        setPasswordRecovery({ status: 'ready', error: null, userId: nextSession.user.id, attempt });
      } else if (event === 'SIGNED_OUT' || (recoveryGrant.current &&
        (event === 'SIGNED_IN' || nextSession?.user.id !== recoveryGrant.current.userId))) {
        cancelPasswordRecovery();
      }
      setSession(nextSession);
      setLoading(false);
    });

    void Linking.getInitialURL().then(url => {
      if (mounted && url) void completePasswordRecovery(url);
    });
    const linkListener = Linking.addEventListener('url', ({ url }) => { void completePasswordRecovery(url); });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      linkListener.remove();
    };
  }, [cancelPasswordRecovery, completePasswordRecovery]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      passwordRecovery,
      cancelPasswordRecovery,
      requestPasswordReset: async email => {
        if (!isSupabaseConfigured) return { error: { message: 'Password recovery is not available yet.' } };
        try {
          const redirectTo = Platform.OS === 'web'
            ? Linking.createURL('auth/reset-password') : 'beybridge://auth/reset-password';
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
          if (!error || error.code === 'user_not_found') return { error: null };
          return { error: { message: error.status === 429
            ? 'Too many reset requests. Please wait a minute and try again.'
            : 'The reset email could not be sent. Check your connection and try again.' } };
        } catch {
          return { error: { message: 'The reset email could not be sent. Check your connection and try again.' } };
        }
      },
      resetRecoveredPassword: async password => {
        const grant = recoveryGrant.current;
        const recoverySession = currentSession.current;
        if (!grant || recoverySession?.user.id !== grant.userId) return { error: { message: RECOVERY_LINK_ERROR } };
        const client = createRecoveryAuthClient();
        try {
          const initialized = await client.setSession({ access_token: recoverySession.access_token,
            refresh_token: recoverySession.refresh_token });
          if (recoveryGrant.current !== grant) return { error: { message: 'Your account changed. Please try again.' } };
          const result = initialized.error ? initialized : await client.updateUser({ password });
          const { error } = result;
          if (recoveryGrant.current !== grant) return { error: { message: 'Your account changed. Please try again.' } };
          if (error) {
            if (isAuthSessionMissingError(error) || error.status === 401 || error.status === 403 || error.code === 'session_not_found' ||
              error.code === 'reauthentication_needed' || error.code === 'reauthentication_not_valid') {
              recoveryGrant.current = null;
              setPasswordRecovery({ status: 'error', error: RECOVERY_LINK_ERROR, userId: null, attempt: grant.attempt });
              return { error: { message: RECOVERY_LINK_ERROR } };
            }
            return { error: { message: error.code === 'weak_password' || error.code === 'same_password'
              ? error.message : 'Your password could not be updated. Please try again.' } };
          }
          recoveryGrant.current = null;
          setPasswordRecovery({ status: 'complete', error: null, userId: grant.userId, attempt: grant.attempt });
          return { error: null };
        } catch {
          return { error: { message: 'Your password could not be updated. Please try again.' } };
        } finally {
          await client.dispose();
        }
      },
      signIn: async (email, password) => {
        if (!isSupabaseConfigured) return { error: null };

        cancelPasswordRecovery();

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      },
      signUp: async (email, password, fullName, accountType) => {
        if (!isSupabaseConfigured) return { error: null };

        cancelPasswordRecovery();

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

        cancelPasswordRecovery();

        const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
        return { error };
      },
      signInWithSocial: async (provider) => {
        if (!isSupabaseConfigured) return { error: null };

        cancelPasswordRecovery();

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

        cancelPasswordRecovery();

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
      deleteAccount: async () => {
        const account = currentSession.current;
        const epoch = authEpoch.current;
        if (!isSupabaseConfigured || !account) return { error: { message: 'Sign in before deleting your account.' } };
        if (deletingAccount.current) return { error: { message: 'Account deletion is already in progress.' } };
        deletingAccount.current = true;
        try {
          const { data, error } = await supabase.functions.invoke('delete-account', {
            body: { confirmation: 'DELETE' },
            headers: { Authorization: `Bearer ${account.access_token}` },
          });
          if (authEpoch.current !== epoch || currentSession.current?.user.id !== account.user.id) {
            return { error: { message: 'Your account changed. The deletion result belongs to your previous account.' } };
          }
          if (error || data?.deleted !== true) return { error: {
            message: 'Account deletion could not be completed. Check your connection and try again. If it keeps failing, contact support.',
          } };
          cancelPasswordRecovery();
          // The server has removed push registrations along with the account.
          // Normal sign-out's push cleanup would fail with the now-deleted JWT.
          const result = await supabase.auth.signOut({ scope: 'local' });
          if (result.error) return { error: { message: 'Your account was deleted, but this device could not sign out. Restart the app.' } };
          return { error: null, deleted: true };
        } catch {
          return { error: { message: 'Account deletion could not be completed. Check your connection and try again.' } };
        } finally {
          deletingAccount.current = false;
        }
      },
    }),
    [loading, session, passwordRecovery, cancelPasswordRecovery]
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
