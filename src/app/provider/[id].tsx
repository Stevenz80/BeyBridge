import React from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import ReviewComposer from '../../components/review-composer';
import { Colors, FontSize, Radius, Shadows, Spacing } from '../../constants/theme';
import { getCategory, getProvider } from '../../lib/mockData';
import { useAuth } from '../../providers/AuthProvider';
import { useMarketplace } from '../../providers/MarketplaceProvider';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const {
    deleteReview,
    favoriteIds,
    getRatingForProvider,
    getReviewsForProvider,
    reviewsLoading,
    saveReview,
    toggleFavorite,
  } = useMarketplace();
  const [reviewComposerVisible, setReviewComposerVisible] = React.useState(false);
  const [savingFavorite, setSavingFavorite] = React.useState(false);
  const provider = getProvider(id);

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
  const call = () => void Linking.openURL(`tel:${provider.phone}`);
  const whatsapp = () => void Linking.openURL(`https://wa.me/${provider.whatsapp}`);
  const directions = () =>
    void Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${provider.latitude},${provider.longitude}`
    );

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
    setReviewComposerVisible(true);
  };

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Service details' }} />

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

      <View style={styles.primaryActions}>
        <ActionButton icon="call" label="Call now" onPress={call} />
        <ActionButton icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} />
      </View>
      <Pressable
        onPress={directions}
        style={({ pressed }) => [styles.directionsButton, pressed && { opacity: 0.75 }]}
      >
        <Ionicons name="navigate-outline" size={19} color={Colors.primary} />
        <Text style={styles.directionsLabel}>Get directions</Text>
      </Pressable>

      <Section title="About this service" icon="information-circle-outline">
        <Text style={styles.bodyText}>{provider.description}</Text>
        <View style={styles.addressRow}>
          <View style={styles.smallIcon}>
            <Ionicons name="location-outline" size={18} color={Colors.primary} />
          </View>
          <View style={styles.addressTextWrap}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.bodyText}>{provider.address}</Text>
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
        <Pressable
          accessibilityRole="button"
          onPress={openReviewComposer}
          style={({ pressed }) => [styles.writeReviewButton, pressed && { opacity: 0.78 }]}
        >
          <Ionicons name={ownReview ? 'create-outline' : 'star-outline'} size={19} color={Colors.textOnPrimary} />
          <Text style={styles.writeReviewLabel}>{ownReview ? 'Edit your review' : 'Write a review'}</Text>
        </Pressable>

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
