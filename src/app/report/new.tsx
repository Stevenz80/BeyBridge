import CenteredState from '@/components/screen-state';
import MarketplaceStatus from '@/components/marketplace-status';
import ReviewsStatus from '@/components/reviews-status';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ContentReportForm from '@/components/content-report-form';
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
  const { providers, providersLoading, providersError, reviews, reviewsLoading, reviewsError } = useMarketplace();
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

  if (providersLoading || (reviewId && reviewsLoading)) {
    return <CenteredState icon="hourglass-outline" title="Loading reported content"
      message="Please wait while we load the service and review." />;
  }

  if (!provider && providersError) {
    return <CenteredState icon="cloud-offline-outline" title="Content could not be loaded"
      message="Check your connection and try again."><MarketplaceStatus /></CenteredState>;
  }

  if (reviewId && !review && reviewsError) {
    return <CenteredState icon="cloud-offline-outline" title="Content could not be loaded"
      message="Check your connection and try again."><ReviewsStatus /></CenteredState>;
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
