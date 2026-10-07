import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMarketplace } from '@/providers/MarketplaceProvider';

export default function ReviewsStatus() {
  const { reviewsLoading, reviewsError, refreshReviews } = useMarketplace();
  if (!reviewsLoading && !reviewsError) return null;
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {reviewsLoading ? <ActivityIndicator color={Colors.primary} /> : null}
      <Text style={styles.message}>{reviewsLoading ? 'Loading reviews…' : reviewsError}</Text>
      {reviewsError ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void refreshReviews()}
          style={({ pressed }) => [styles.retry, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.retryText}>Retry reviews</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  message: { flex: 1, color: Colors.textMuted, fontSize: 14, lineHeight: 21 },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, backgroundColor: Colors.surface },
  retryText: { color: Colors.primary, fontWeight: '700' },
});
