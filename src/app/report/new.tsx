import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ContentReportForm from '@/components/content-report-form';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useLocalization } from '@/providers/LocalizationProvider';
import { useTrust } from '@/providers/TrustProvider';

export default function NewReportScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { providerId, reviewId } = useLocalSearchParams<{
    providerId: string;
    reviewId?: string;
  }>();
  const { user } = useAuth();
  const { providers, reviews } = useMarketplace();
  const { submitReport } = useTrust();
  const [busy, setBusy] = useState(false);
  const provider = providers.find((item) => item.id === providerId);
  const review = reviewId ? reviews.find((item) => item.id === reviewId) : undefined;
  const targetType = reviewId ? 'review' : 'provider';

  if (!user) {
    return (
      <CenteredState
        icon="lock-closed-outline"
        title="Sign in to report"
        message="A signed-in account helps prevent abuse while your identity remains private from the reported person or business."
        action="Go to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (!provider || (reviewId && (!review || review.providerId !== provider.id))) {
    return (
      <CenteredState
        icon="alert-circle-outline"
        title="Content unavailable"
        message="The service or review you tried to report is no longer available."
      />
    );
  }

  if (provider.ownerId === user.id || review?.userId === user.id) {
    return (
      <CenteredState
        icon="information-circle-outline"
        title="This is your content"
        message="Use the editing controls instead of reporting content you own."
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('Report content') }} />
      <ContentReportForm
        targetLabel={review ? `${review.userName}'s review of ${provider.name}` : provider.name}
        targetType={targetType}
        providerId={provider.id}
        reviewId={review?.id ?? null}
        busy={busy}
        onSubmit={async (input) => {
          setBusy(true);
          const result = await submitReport(input);
          setBusy(false);
          if (result.error) return result.error;
          Alert.alert(
            'Report submitted',
            'Thank you. An administrator can now review the content and record an outcome.',
            [{ text: 'Done', onPress: () => router.back() }]
          );
          return null;
        }}
      />
    </>
  );
}

function CenteredState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.icon}>
        <Ionicons name={icon as never} size={34} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  icon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: Colors.primarySoft,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  message: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  button: {
    minHeight: 50,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  buttonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
