import React, { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { Review } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function ProfileReviewsScreen() {
  const router = useRouter();
  const { locale, t } = useLocalization();
  const { user } = useAuth();
  const { providers, reviews, reviewsLoading } = useMarketplace();
  const userReviews = useMemo(
    () => reviews.filter((review) => review.userId === user?.id),
    [reviews, user?.id]
  );

  return (
    <>
      <Stack.Screen options={{ title: t('Your reviews') }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={userReviews}
        keyExtractor={(review) => review.id}
        contentContainerStyle={[styles.list, userReviews.length === 0 && styles.emptyList]}
        renderItem={({ item }) => {
          const provider = providers.find((candidate) => candidate.id === item.providerId);
          return (
            <ReviewCard
              review={item}
              providerName={provider?.name ?? 'Unavailable service'}
              locale={locale}
              onPress={provider ? () => router.push(`/provider/${provider.id}`) : undefined}
            />
          );
        }}
        ListHeaderComponent={
          userReviews.length ? (
            <View style={styles.header}>
              <Text style={styles.title}>Reviews you shared</Text>
              <Text style={styles.subtitle}>
                Your feedback helps neighbors choose local services with confidence.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={34} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{reviewsLoading ? 'Loading your reviews…' : 'No reviews yet'}</Text>
            <Text style={styles.emptyText}>
              After using a service, open its page to rate your experience and leave helpful details.
            </Text>
            {!reviewsLoading ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/search')}
                style={({ pressed }) => [styles.browseButton, pressed && styles.pressed]}
              >
                <Text style={styles.browseButtonText}>Browse services</Text>
                <Ionicons name="arrow-forward" size={18} color={Colors.textOnPrimary} />
              </Pressable>
            ) : null}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

function ReviewCard({
  review,
  providerName,
  locale,
  onPress,
}: {
  review: Review;
  providerName: string;
  locale: 'en' | 'ar';
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${review.rating} star review for ${providerName}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.providerIcon}>
          <Ionicons name="storefront-outline" size={22} color={Colors.primary} />
        </View>
        <View style={styles.cardHeading}>
          <Text style={styles.providerName}>{providerName}</Text>
          <Text style={styles.reviewDate}>
            {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-LB' : 'en', { dateStyle: 'medium' }).format(new Date(review.createdAt))}
          </Text>
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={20} color={Colors.primary} /> : null}
      </View>
      <View accessibilityLabel={`${review.rating} out of 5 stars`} style={styles.stars}>
        {Array.from({ length: 5 }, (_, index) => (
          <Ionicons
            key={index}
            name={index < review.rating ? 'star' : 'star-outline'}
            size={18}
            color={Colors.star}
          />
        ))}
      </View>
      <Text style={styles.comment}>{review.comment}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.background,
  },
  emptyList: { flexGrow: 1, padding: 0 },
  header: { gap: 4, paddingBottom: Spacing.xs },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21 },
  card: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  providerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  cardHeading: { flex: 1, gap: 2 },
  providerName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  reviewDate: { color: Colors.textMuted, fontSize: FontSize.xs },
  stars: { flexDirection: 'row', gap: 3 },
  comment: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 21 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  emptyText: {
    maxWidth: 330,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  browseButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  browseButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.7 },
});
