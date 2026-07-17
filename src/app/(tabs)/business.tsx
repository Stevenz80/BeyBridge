import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '@/components/BrandLogo';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/mockData';
import type { Provider } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';

export default function BusinessScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    deleteProviderListing,
    getRatingForProvider,
    profile,
    profileLoading,
    providerListings,
    providersLoading,
    updateProviderListingStatus,
  } = useMarketplace();
  const [busyListingId, setBusyListingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const summaries = providerListings.map((listing) => getRatingForProvider(listing.id));
    const reviewCount = summaries.reduce((total, summary) => total + summary.count, 0);
    const ratingTotal = summaries.reduce(
      (total, summary) => total + summary.average * summary.count,
      0
    );

    return {
      published: providerListings.filter((listing) => listing.listingStatus === 'published').length,
      reviewCount,
      average: reviewCount ? ratingTotal / reviewCount : 0,
    };
  }, [getRatingForProvider, providerListings]);

  const changeStatus = async (listing: Provider) => {
    const nextStatus = listing.listingStatus === 'published' ? 'paused' : 'published';
    setBusyListingId(listing.id);
    const result = await updateProviderListingStatus(listing.id, nextStatus);
    setBusyListingId(null);
    if (result.error) Alert.alert('Could not update listing', result.error);
  };

  const confirmDelete = (listing: Provider) => {
    Alert.alert(
      'Delete this listing?',
      `${listing.name} and its saved entries and reviews will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setBusyListingId(listing.id);
            void deleteProviderListing(listing.id).then((result) => {
              setBusyListingId(null);
              if (result.error) Alert.alert('Could not delete listing', result.error);
            });
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <CenteredState
        icon="person-circle-outline"
        title="Sign in to manage your business"
        message="Your listings, reviews, and publishing controls will appear here."
        action="Go to profile"
        onAction={() => router.push('/profile')}
      />
    );
  }

  if (profileLoading || (providersLoading && !profile)) {
    return (
      <CenteredState
        loading
        icon="briefcase-outline"
        title="Preparing your dashboard"
        message="Loading your provider profile and listings."
      />
    );
  }

  if (profile?.accountType !== 'provider') {
    return (
      <CenteredState
        icon="briefcase-outline"
        title="Provider mode is not enabled"
        message="Change your account type to Service provider from your profile to list a service."
        action="Edit profile"
        onAction={() => router.push('/profile')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BrandLogo variant="white" width={210} />
          <View style={styles.providerBadge}>
            <Ionicons name="briefcase" size={15} color={Colors.primaryDark} />
            <Text style={styles.providerBadgeText}>PROVIDER</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>YOUR BUSINESS</Text>
            <Text style={styles.title}>Manage your services</Text>
            <Text style={styles.subtitle}>
              Publish a clear listing, keep availability current, and follow customer feedback.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/provider/manage')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={22} color={Colors.textOnPrimary} />
            <Text style={styles.addButtonText}>New service</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Listings" value={String(providerListings.length)} icon="layers-outline" />
          <StatCard label="Live" value={String(stats.published)} icon="eye-outline" />
          <StatCard
            label="Rating"
            value={stats.reviewCount ? stats.average.toFixed(1) : 'New'}
            icon="star-outline"
          />
        </View>

        {providerListings.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="storefront-outline" size={34} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Create your first service listing</Text>
            <Text style={styles.emptyText}>
              Customers need the essentials before they can choose you. You can save a draft and
              publish when it is ready.
            </Text>
            <View style={styles.steps}>
              <Step number="1" text="Describe the service and choose its category" />
              <Step number="2" text="Add contact details, coverage area, pricing, and hours" />
              <Step number="3" text="Preview it, then publish it to the marketplace" />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/provider/manage')}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>Start my listing</Text>
              <Ionicons name="arrow-forward" size={19} color={Colors.textOnPrimary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.listingsSection}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>Your listings</Text>
                <Text style={styles.sectionSubtitle}>
                  {stats.reviewCount} customer {stats.reviewCount === 1 ? 'review' : 'reviews'}
                </Text>
              </View>
            </View>

            {providerListings.map((listing) => {
              const rating = getRatingForProvider(listing.id);
              const isBusy = busyListingId === listing.id;
              const status = listing.listingStatus ?? 'draft';
              const category = getCategory(listing.categoryId);

              return (
                <View key={listing.id} style={styles.listingCard}>
                  <View style={styles.listingHeader}>
                    <View style={styles.listingIcon}>
                      <Ionicons
                        name={(category?.icon ?? 'construct-outline') as never}
                        size={24}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={styles.listingHeadingCopy}>
                      <Text style={styles.listingName}>{listing.name}</Text>
                      <Text style={styles.listingMeta}>
                        {category?.name ?? 'Local service'} · {listing.area || 'Area not set'}
                      </Text>
                    </View>
                    <StatusBadge status={status} />
                  </View>

                  <View style={styles.listingMetrics}>
                    <Metric icon="star" value={rating.count ? rating.average.toFixed(1) : 'New'} />
                    <Metric
                      icon="chatbubble-outline"
                      value={`${rating.count} ${rating.count === 1 ? 'review' : 'reviews'}`}
                    />
                    <Metric icon="pricetag-outline" value={formatPrice(listing)} />
                  </View>

                  <View style={styles.listingActions}>
                    {status === 'published' && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => router.push(`/provider/${listing.id}`)}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                      >
                        <Ionicons name="eye-outline" size={18} color={Colors.primary} />
                        <Text style={styles.secondaryButtonText}>View</Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({ pathname: '/provider/manage', params: { id: listing.id } })
                      }
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="create-outline" size={18} color={Colors.primary} />
                      <Text style={styles.secondaryButtonText}>
                        {status === 'draft' ? 'Finish' : 'Edit'}
                      </Text>
                    </Pressable>
                    {status !== 'draft' && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ busy: isBusy }}
                        disabled={isBusy}
                        onPress={() => void changeStatus(listing)}
                        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                      >
                        {isBusy ? (
                          <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                          <Ionicons
                            name={status === 'published' ? 'pause-outline' : 'play-outline'}
                            size={18}
                            color={Colors.primary}
                          />
                        )}
                        <Text style={styles.secondaryButtonText}>
                          {status === 'published' ? 'Pause' : 'Publish'}
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => confirmDelete(listing)}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                    <Text style={styles.deleteButtonText}>Delete listing</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as never} size={18} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: 'draft' | 'published' | 'paused' }) {
  const label = status === 'published' ? 'Live' : status === 'paused' ? 'Paused' : 'Draft';
  return (
    <View
      style={[
        styles.statusBadge,
        status === 'published' && styles.statusLive,
        status === 'paused' && styles.statusPaused,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          status === 'published' && styles.statusDotLive,
          status === 'paused' && styles.statusDotPaused,
        ]}
      />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function Metric({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon as never} size={15} color={Colors.textMuted} />
      <Text style={styles.metricText}>{value}</Text>
    </View>
  );
}

function CenteredState({
  icon,
  title,
  message,
  action,
  onAction,
  loading,
}: {
  icon: string;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <SafeAreaView style={styles.centered}>
      <View style={styles.emptyIcon}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Ionicons name={icon as never} size={34} color={Colors.primary} />
        )}
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
      {action && onAction && (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{action}</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function formatPrice(provider: Provider) {
  if (provider.priceType === 'quote' || provider.startingPrice == null) return 'Quote';
  const amount = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(
    provider.startingPrice
  );
  const suffix = provider.priceType === 'hourly' ? '/hr' : '';
  return `${amount} ${provider.priceCurrency ?? 'USD'}${suffix}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  content: { gap: Spacing.md, paddingBottom: Spacing.xl, backgroundColor: Colors.background },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  providerBadgeText: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  hero: {
    gap: Spacing.md,
    marginHorizontal: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySoft,
  },
  heroCopy: { gap: Spacing.xs },
  eyebrow: { color: Colors.primaryDark, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21 },
  addButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  addButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  statCard: {
    minHeight: 100,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  statValue: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  emptyCard: {
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  steps: { alignSelf: 'stretch', gap: Spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepNumber: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.primarySoft,
  },
  stepNumberText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '900' },
  stepText: { flex: 1, color: Colors.text, fontSize: FontSize.sm, lineHeight: 20 },
  primaryButton: {
    minHeight: 52,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  listingsSection: { gap: Spacing.md, paddingHorizontal: Spacing.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs },
  listingCard: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  listingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  listingIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  listingHeadingCopy: { flex: 1, gap: 3 },
  listingName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  listingMeta: { color: Colors.textMuted, fontSize: FontSize.xs },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },
  statusLive: { backgroundColor: Colors.successSoft },
  statusPaused: { backgroundColor: Colors.primarySoft },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.textSubtle },
  statusDotLive: { backgroundColor: Colors.success },
  statusDotPaused: { backgroundColor: Colors.primary },
  statusText: { color: Colors.text, fontSize: 10, fontWeight: '900' },
  listingMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },
  metricText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  listingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  secondaryButton: {
    minHeight: 44,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  deleteButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deleteButtonText: { color: Colors.danger, fontSize: FontSize.xs, fontWeight: '800' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  pressed: { opacity: 0.72 },
});
