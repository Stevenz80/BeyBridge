import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';

import { Colors, FontSize, Spacing } from '@/constants/theme';
import { parseAuthCallbackUrl } from '@/lib/auth';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { loading, user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace('/profile');
  }, [loading, router, user]);

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL().then((url) => {
      if (!active || !url) return;
      try {
        const callback = parseAuthCallbackUrl(url);
        if (callback.errorMessage) setError(callback.errorMessage);
      } catch {
        setError('The sign-in response could not be read. Please try again.');
      }
    });

    const timeout = setTimeout(() => {
      if (active && !user) {
        setError('Sign-in did not finish. Return to your account and try again.');
      }
    }, 12_000);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [user]);

  return (
    <View style={styles.screen}>
      {error ? (
        <>
          <Text style={styles.title}>Sign-in could not be completed</Text>
          <Text style={styles.text}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/profile')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Back to account</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.title}>Completing sign-in…</Text>
          <Text style={styles.text}>BeyBridge will return you to your account automatically.</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  text: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  button: {
    minHeight: 48,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  buttonPressed: { opacity: 0.84 },
  buttonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
});
