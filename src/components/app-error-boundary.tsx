import { Ionicons } from '@expo/vector-icons';
import type { ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { readStoredLocale } from '@/lib/locale-storage';
import { Sentry } from '@/lib/monitoring';

const COPY = {
  en: {
    title: 'Something went wrong',
    body: 'This screen hit an unexpected problem. Your account and saved services are safe.',
    retry: 'Try again',
  },
  ar: {
    title: 'حدث خطأ ما',
    body: 'واجهت هذه الشاشة مشكلة غير متوقعة. حسابك وخدماتك المحفوظة بأمان.',
    retry: 'حاول مجددًا',
  },
};

// Expo Router renders this instead of a route that throws while rendering, so a
// single screen failure no longer closes the whole app. It can replace the root
// layout itself, so it must not depend on app providers (localization, auth).
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const locale = readStoredLocale();
  const copy = COPY[locale];

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={[styles.screen, { direction: locale === 'ar' ? 'rtl' : 'ltr' }]}>
      <View style={styles.icon}>
        <Ionicons name="alert-circle-outline" size={34} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      <Pressable accessibilityRole="button" onPress={() => void retry()}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{copy.retry}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  icon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  body: { maxWidth: 320, color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  button: {
    minHeight: 50,
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  buttonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.8 },
});
