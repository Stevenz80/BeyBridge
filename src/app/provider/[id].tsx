import React from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ReviewComposer from '../../components/review-composer';
import { Colors, FontSize, Radius, Shadows, Spacing } from '../../constants/theme';
import { getCategory } from '../../lib/mockData';
import type { Provider, ServiceMode } from '../../lib/types';
import { useAuth } from '../../providers/AuthProvider';
import { useMarketplace } from '../../providers/MarketplaceProvider';
import { useLocalization } from '../../providers/LocalizationProvider';
import { useServiceRequests } from '../../providers/ServiceRequestProvider';

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export default function ProviderDetailsScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const {
    deleteReview,
    favoriteIds,
    getRatingForProvider,
    getReviewsForProvider,
    providers,
    reviewsLoading,
    saveReview,
    toggleFavorite,
  } = useMarketplace();
  const { customerRequests, loading: requestsLoading } = useServiceRequests();
  const [reviewComposerVisible, setReviewComposerVisible] = React.useState(false);
  const [savingFavorite, setSavingFavorite] = React.useState(false);
  const provider = providers.find((item) => item.id === id);

  if (!provider) {
    return (
      <View style={styles.notFound}>
        <View style={styles.notFoundIcon}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.notFoundTitle}>Service unavailable</Text>
        <Text style={styles.notFoundText}>This provider is no longer listed.</Text>
      </View>
    );
  }

  const category = getCategory(provider.categoryId);
  const reviews = getReviewsForProvider(provider.id);
  const rating = getRatingForProvider(provider.id);
  const isSaved = favoriteIds.has(provider.id);
  const ownReview = reviews.find((review) => review.userId === user?.id);
  const completedRequest = customerRequests.find(
    (request) => request.providerId === provider.id && request.status === 'completed'
  );
  const canReview = Boolean(ownReview || completedRequest);
  const isOwner = provider.ownerId === user?.id;
  const call = () => void Linking.openURL(`tel:${provider.phone}`);
  const whatsapp = () => void Linking.openURL(`https://wa.me/${provider.whatsapp}`);
  const directions =
    provider.latitude !== null && provider.longitude !== null
      ? () =>
          void Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${provider.latitude},${provider.longitude}`
          )
      : null;

  const saveFavorite = async () => {
    if (!user) {
      Alert.alert('Sign in to save', 'Sign in to keep this service in your Saved tab.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/profile') },
      ]);
      return;
    }

    setSavingFavorite(true);
    const result = await toggleFavorite(provider.id);
    setSavingFavorite(false);
    if (result.error) Alert.alert('Could not update Saved', result.error);
  };

  const openReviewComposer = () => {
    if (!user) {
      Alert.alert('Sign in to review', 'Only signed-in customers can publish and manage reviews.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/profile') },
      ]);
      return;
    }
    if (!canReview) {
      Alert.alert(
        'Review after a completed service',
        'BeyBridge reviews come from customers who completed a service request with this provider.'
      );
      return;
    }
    setReviewComposerVisible(true);
  };

  const openServiceRequest = () => {
    if (!user) {
      Alert.alert(
        'Sign in to request service',
        'Your account keeps the request private and lets you track the provider response.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/profile') },
        ]
      );
      return;
    }

    router.push({ pathname: '/request/new', params: { providerId: provider.id } });
  };

  const openReport = (reviewId?: string) => {
    router.push({
      pathname: '/report/new',
      params: reviewId ? { providerId: provider.id, reviewId } : { providerId: provider.id },
    });
  };

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: t('Service details') }} />

      <View style={styles.summaryCard}>
        <View style={styles.serviceIcon}>
          <Ionicons
            name={(category?.icon ?? 'construct-outline') as never}
            size={30}
            color={Colors.primary}
          />
        </View>
        <Text style={styles.category}>{category?.name ?? 'Local service'}</Text>
        <Text style={styles.name}>{provider.name}</Text>
        <View style={styles.badgeRow}>
          {provider.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
          {provider.emergencyService && (
            <View style={styles.emergencyBadge}>
              <Ionicons name="flash" size={14} color={Colors.primaryDark} />
              <Text style={styles.emergencyText}>Urgent requests</Text>
            </View>
          )}
        </View>
        <View style={styles.summaryMeta}>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color={Colors.star} />
            {rating.count ? (
              <>
                <Text style={styles.rating}>{rating.average.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({rating.count} {rating.count === 1 ? 'review' : 'reviews'})</Text>
              </>
            ) : (
              <Text style={styles.reviewCount}>New—no reviews yet</Text>
            )}
          </View>
          <View style={styles.areaRow}>
            <Ionicons name="location-outline" size={16} color={Colors.primary} />
            <Text style={styles.area}>{provider.area}</Text>
          </View>
        </View>
      </View>

      {isOwner ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/provider/manage', params: { id: provider.id } })}
          style={({ pressed }) => [styles.ownerButton, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="create-outline" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.ownerButtonLabel}>Edit your listing</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Remove service from Saved' : 'Save service'}
          accessibilityState={{ selected: isSaved, busy: savingFavorite }}
          disabled={savingFavorite}
          onPress={saveFavorite}
          style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.75 }]}
        >
          {savingFavorite ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={20}
              color={isSaved ? Colors.danger : Colors.primary}
            />
          )}
          <Text style={styles.saveButtonLabel}>{isSaved ? 'Saved' : 'Save service'}</Text>
        </Pressable>
      )}

      {!isOwner ? (
        <Pressable
          accessibilityRole="button"
          onPress={openServiceRequest}
          style={({ pressed }) => [styles.requestButton, pressed && styles.actionPressed]}
        >
          <Ionicons name="paper-plane-outline" size={20} color={Colors.textOnPrimary} />
          <Text style={styles.requestButtonLabel}>Request this service</Text>
        </Pressable>
      ) : null}

      <View style={styles.primaryActions}>
        {provider.phone ? <ActionButton icon="call" label="Call now" onPress={call} /> : null}
        {provider.whatsapp ? (
          <ActionButton icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} />
        ) : null}
      </View>
      {directions && (
        <Pressable
          onPress={directions}
          style={({ pressed }) => [styles.directionsButton, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="navigate-outline" size={19} color={Colors.primary} />
          <Text style={styles.directionsLabel}>Get directions</Text>
        </Pressable>
      )}

      {!isOwner ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Report this service"
          onPress={() => openReport()}
          style={({ pressed }) => [styles.reportListingButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="flag-outline" size={17} color={Colors.textMuted} />
          <Text style={styles.reportListingLabel}>Report this service</Text>
        </Pressable>
      ) : null}

      <Section title="About this service" icon="information-circle-outline">
        <Text style={styles.bodyText}>{provider.description || 'Details coming soon.'}</Text>
        <View style={styles.serviceFacts}>
          <ServiceFact icon="pricetag-outline" label="Pricing" value={formatPrice(provider)} />
          <ServiceFact
            icon="navigate-outline"
            label="Service setup"
            value={formatServiceMode(provider.serviceMode)}
          />
          {provider.yearsExperience != null && (
            <ServiceFact
              icon="ribbon-outline"
              label="Experience"
              value={`${provider.yearsExperience} ${provider.yearsExperience === 1 ? 'year' : 'years'}`}
            />
          )}
        </View>
        <View style={styles.addressRow}>
          <View style={styles.smallIcon}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.addressTextWrap}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.bodyText}>{provider.address || provider.area}</Text>
          </View>
        </View>
      </Section>

      <Section title="Opening hours" icon="time-outline">
        {Object.entries(provider.openingHours).map(([day, hours]) => (
          <View key={day} style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{DAY_LABELS[day] ?? day}</Text>
            <Text style={[styles.hoursValue, hours === 'Closed' && styles.closed]}>{hours}</Text>
          </View>
        ))}
      </Section>

      <Section title={`Reviews (${reviews.length})`} icon="chatbubble-ellipses-outline">
        {!isOwner && user && requestsLoading && !ownReview ? (
          <View style={styles.reviewEligibilityCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.reviewEligibilityText}>Checking review eligibility…</Text>
          </View>
        ) : !isOwner && (!user || canReview) ? (
          <Pressable
            accessibilityRole="button"
            onPress={openReviewComposer}
            style={({ pressed }) => [styles.writeReviewButton, pressed && { opacity: 0.78 }]}
          >
            <Ionicons name={ownReview ? 'create-outline' : 'star-outline'} size={19} color={Colors.textOnPrimary} />
            <Text style={styles.writeReviewLabel}>{ownReview ? 'Edit your review' : 'Write a review'}</Text>
          </Pressable>
        ) : !isOwner && user ? (
          <View style={styles.reviewEligibilityCard}>
            <Ionicons name="shield-checkmark-outline" size={19} color={Colors.primary} />
            <Text style={styles.reviewEligibilityText}>
              Reviews unlock after a completed service request.
            </Text>
          </View>
        ) : null}

        {reviewsLoading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : reviews.length === 0 ? (
          <Text style={styles.bodyMuted}>No written reviews yet.</Text>
        ) : (
          reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewAuthorRow}>
                  <Text style={styles.reviewName}>{review.userName}</Text>
                  {review.userId === user?.id && <Text style={styles.ownReviewBadge}>You</Text>}
                </View>
                <View style={styles.reviewStars}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Ionicons
                      key={index}
                      name={index < review.rating ? 'star' : 'star-outline'}
                      size={13}
                      color={Colors.star}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.bodyText}>{review.comment}</Text>
              <Text style={styles.reviewDate}>
                {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(review.createdAt))}
              </Text>
              {review.userId !== user?.id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Report ${review.userName}'s review`}
                  onPress={() => openReport(review.id)}
                  style={({ pressed }) => [styles.reportReviewButton, pressed && { opacity: 0.65 }]}
                >
                  <Ionicons name="flag-outline" size={14} color={Colors.textSubtle} />
                  <Text style={styles.reportReviewLabel}>Report review</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </Section>
    </ScrollView>
      {reviewComposerVisible && (
        <ReviewComposer
          visible
          providerName={provider.name}
          review={ownReview}
          onClose={() => setReviewComposerVisible(false)}
          onSave={(nextRating, comment) => saveReview(provider.id, nextRating, comment)}
          onDelete={ownReview ? () => deleteReview(ownReview.id) : undefined}
        />
      )}
    </>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Ionicons name={icon as never} size={20} color={Colors.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
    >
      <Ionicons name={icon as never} size={20} color={Colors.textOnPrimary} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function ServiceFact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.serviceFact}>
      <Ionicons name={icon as never} size={17} color={Colors.primary} />
      <View style={styles.serviceFactCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.serviceFactValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatPrice(provider: Provider) {
  if (provider.priceType === 'quote' || provider.startingPrice == null) return 'Contact for quote';
  const amount = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(
    provider.startingPrice
  );
  const suffix = provider.priceType === 'hourly' ? ' per hour' : ' starting';
  return `${amount} ${provider.priceCurrency ?? 'USD'}${suffix}`;
}

function formatServiceMode(mode?: ServiceMode) {
  if (mode === 'on_site') return 'At provider location';
  if (mode === 'both') return 'Mobile and on-site';
  return 'Mobile service';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
  summaryCard: {
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  serviceIcon: {
    width: 64,
    height: 64,
    marginBottom: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  category: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '900' },
  name: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.xs },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.successSoft,
  },
  verifiedText: { color: Colors.success, fontSize: 10, fontWeight: '900' },
  emergencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  emergencyText: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900' },
  summaryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  reviewCount: { color: Colors.textMuted, fontSize: FontSize.xs },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  area: { color: Colors.textMuted, fontSize: FontSize.sm },
  primaryActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  saveButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  saveButtonLabel: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  requestButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  requestButtonLabel: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: '900' },
  ownerButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  ownerButtonLabel: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  actionButton: {
    minHeight: 54,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  actionPressed: { backgroundColor: Colors.primaryPressed },
  actionLabel: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  directionsButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  directionsLabel: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  reportListingButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  reportListingLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  section: {
    gap: Spacing.sm + 2,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  bodyText: { flexShrink: 1, color: Colors.text, fontSize: FontSize.sm, lineHeight: 21 },
  bodyMuted: { color: Colors.textMuted, fontSize: FontSize.sm },
  serviceFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  serviceFact: {
    minWidth: 130,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  serviceFactCopy: { flex: 1, gap: 2 },
  serviceFactValue: { color: Colors.text, fontSize: FontSize.xs, fontWeight: '800' },
  writeReviewButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  writeReviewLabel: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  reviewEligibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  reviewEligibilityText: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  smallIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  addressTextWrap: { flex: 1, gap: 2 },
  detailLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  hoursDay: { color: Colors.textMuted, fontSize: FontSize.sm },
  hoursValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  closed: { color: Colors.danger },
  reviewCard: { gap: 5, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  reviewName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  ownReviewBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.full,
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySoft,
    fontSize: 10,
    fontWeight: '900',
  },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewDate: { color: Colors.textSubtle, fontSize: FontSize.xs },
  reportReviewButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  reportReviewLabel: { color: Colors.textSubtle, fontSize: FontSize.xs, fontWeight: '700' },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  notFoundIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
  },
  notFoundTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  notFoundText: { color: Colors.textMuted, fontSize: FontSize.sm },
});
