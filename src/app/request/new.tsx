import CenteredState from '@/components/screen-state';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ServiceRequestForm from '@/components/service-request-form';
import MarketplaceStatus from '@/components/marketplace-status';
import AccountStatus from '@/components/account-status';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useServiceRequests } from '@/providers/ServiceRequestProvider';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function NewServiceRequestScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const { user } = useAuth();
  const { profile, profileLoading, providers, providersLoading, providersError, accountError } = useMarketplace();
  const { createServiceRequest } = useServiceRequests();
  const [busy, setBusy] = useState(false);
  const provider = providers.find((item) => item.id === providerId);

  if (!user) {
    return (
      <CenteredState
        icon="person-circle-outline"
        title="Sign in to request this service"
        message="Your account keeps requests private and lets you follow each response."
        action="Go to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (profileLoading || providersLoading) {
    return (
      <CenteredState
        icon="hourglass-outline"
        title="Preparing your request"
        message="Loading your profile and this service."
      />
    );
  }

  if (!provider || provider.listingStatus === 'paused' || provider.listingStatus === 'draft') {
    if (!provider && providersError) {
      return <View style={styles.centered}><MarketplaceStatus /></View>;
    }
    return (
      <CenteredState
        icon="alert-circle-outline"
        title="Service unavailable"
        message="This listing is not currently accepting requests."
        action="Browse services"
        onAction={() => router.replace('/')}
      />
    );
  }

  if (provider.ownerId === user.id) {
    return (
      <CenteredState
        icon="briefcase-outline"
        title="This is your listing"
        message="Manage customer requests from your Business tab."
        action="Open Business"
        onAction={() => router.replace('/business')}
      />
    );
  }

  if (!profile?.phone.trim()) {
    if (!profile && accountError) {
      return <View style={styles.centered}><AccountStatus /></View>;
    }
    return (
      <CenteredState
        icon="call-outline"
        title="Add a phone number first"
        message="Providers need a reliable way to contact you about the job. Add your number in Profile, then return here."
        action="Edit profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('Request service') }} />
      <ServiceRequestForm
        provider={provider}
        defaultAddress={profile.defaultArea}
        busy={busy}
        onSubmit={async (input) => {
          setBusy(true);
          const result = await createServiceRequest(input);
          setBusy(false);
          if (result.error) return result.error;

          Alert.alert('Request sent', `${provider.name} can now review and respond to your request.`);
          if (result.request) {
            router.replace({ pathname: '/request/[id]', params: { id: result.request.id } });
          } else {
            router.replace('/requests');
          }
          return null;
        }}
      />
    </>
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
});
