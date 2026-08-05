import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ProviderVerificationForm from '@/components/provider-verification-form';
import VerificationDocumentList from '@/components/verification-document-list';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useTrust } from '@/providers/TrustProvider';

export default function ProviderVerificationScreen() {
  const router = useRouter();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const { user } = useAuth();
  const { providerListings, providersLoading } = useMarketplace();
  const { myVerificationRequests, submitVerification, trustLoading } = useTrust();
  const [busy, setBusy] = useState(false);
  const provider = providerListings.find((item) => item.id === providerId);
  const latestRequest = myVerificationRequests.find((item) => item.providerId === providerId);

  if (!user) {
    return (
      <CenteredState
        icon="lock-closed-outline"
        title="Sign in to continue"
        message="Provider verification is available only to the listing owner."
        action="Go to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (providersLoading || trustLoading) {
    return (
      <CenteredState
        icon="shield-checkmark-outline"
        title="Loading verification"
        message="Checking the listing and its latest review status."
      />
    );
  }

  if (!provider || provider.ownerId !== user.id) {
    return (
      <CenteredState
        icon="alert-circle-outline"
        title="Listing unavailable"
        message="Only the owner can request verification for this listing."
      />
    );
  }

  if (provider.isVerified) {
    return (
      <CenteredState
        icon="checkmark-circle-outline"
        title="Listing verified"
        message={`${provider.name} already carries the BeyBridge verification badge.`}
        action="Back to Business"
        onAction={() => router.replace('/business')}
      />
    );
  }

  if (latestRequest?.status === 'pending') {
    return (
      <>
        <Stack.Screen options={{ title: 'Verification evidence' }} />
        <ScrollView
          style={styles.pendingScreen}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.pendingContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.pendingHero}>
            <View style={styles.icon}>
              <Ionicons name="time-outline" size={34} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Review pending</Text>
            <Text style={styles.message}>
              An administrator will review your evidence. You can safely add or remove supporting
              documents while the request is pending.
            </Text>
          </View>
          <VerificationDocumentList request={latestRequest} editable />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/business')}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonText}>Back to Business</Text>
          </Pressable>
        </ScrollView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Provider verification' }} />
      <ProviderVerificationForm
        provider={provider}
        busy={busy}
        onSubmit={async (input) => {
          setBusy(true);
          const result = await submitVerification(input);
          setBusy(false);
          if (result.error) return result.error;
          Alert.alert(
            'Submitted for review',
            'Your request is in the administrator queue. You can attach private supporting documents now or return later.',
            [
              { text: 'Add documents' },
              { text: 'Later', onPress: () => router.replace('/business') },
            ]
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
  pendingScreen: { flex: 1, backgroundColor: Colors.background },
  pendingContent: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  pendingHero: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySoft,
  },
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
