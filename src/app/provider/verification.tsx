import CenteredState from '@/components/screen-state';
import MarketplaceStatus from '@/components/marketplace-status';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ProviderVerificationForm from '@/components/provider-verification-form';
import VerificationDocumentList from '@/components/verification-document-list';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useTrust } from '@/providers/TrustProvider';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function ProviderVerificationScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const { user } = useAuth();
  const { providerListings, providersLoading, providersError } = useMarketplace();
  const { myVerificationRequests, submitVerification, trustLoading, trustError, refreshTrustData } = useTrust();
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

  if (!provider && providersError) {
    return <CenteredState icon="cloud-offline-outline" title="This listing could not be loaded"
      message="Check your connection and try again."><MarketplaceStatus /></CenteredState>;
  }

  if (trustError) {
    return <CenteredState icon="cloud-offline-outline" title="Could not load verification"
      message="Check your connection and try again." action="Try again"
      onAction={() => void refreshTrustData()} />;
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
        <Stack.Screen options={{ title: t('Verification evidence') }} />
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
      <Stack.Screen options={{ title: t('Provider verification') }} />
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
