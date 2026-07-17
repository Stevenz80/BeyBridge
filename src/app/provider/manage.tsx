import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ProviderListingEditor from '@/components/provider-listing-editor';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ProviderListingInput } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';

export default function ManageProviderListingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const {
    profile,
    profileLoading,
    providerListings,
    providersLoading,
    saveProviderListing,
  } = useMarketplace();
  const listing = id ? providerListings.find((item) => item.id === id) ?? null : null;
  const loading = profileLoading || providersLoading;

  const save = async (input: ProviderListingInput) => {
    const result = await saveProviderListing(id ?? null, input);
    if (!result.error) router.replace('/business');
    return result;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: id ? 'Edit listing' : 'New service listing' }} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.message}>Loading your listing…</Text>
      </View>
    );
  }

  if (!user || profile?.accountType !== 'provider') {
    return (
      <MessageState
        icon="briefcase-outline"
        title="Provider account required"
        message="Sign in and enable Service provider in your profile before creating a listing."
        action="Go to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (id && !listing) {
    return (
      <MessageState
        icon="alert-circle-outline"
        title="Listing not found"
        message="This listing is no longer available in your provider account."
        action="Back to dashboard"
        onAction={() => router.replace('/business')}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: listing ? 'Edit listing' : 'New service listing' }} />
      <ProviderListingEditor
        key={listing?.id ?? 'new-listing'}
        listing={listing}
        fallbackName={listing ? '' : profile.fullName}
        fallbackPhone={listing ? '' : profile.phone}
        fallbackArea={listing ? '' : profile.defaultArea}
        onSave={save}
      />
    </>
  );
}

function MessageState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  message: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.icon}>
        <Ionicons name={icon as never} size={32} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.72 }]}
      >
        <Text style={styles.buttonText}>{action}</Text>
      </Pressable>
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
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  message: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  buttonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
});
