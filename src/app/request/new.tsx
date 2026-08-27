import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ServiceRequestForm from '@/components/service-request-form';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useServiceRequests } from '@/providers/ServiceRequestProvider';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function NewServiceRequestScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();
  const { user } = useAuth();
  const { profile, profileLoading, providers, providersLoading } = useMarketplace();
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
