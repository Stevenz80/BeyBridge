import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';

import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/mockData';
import type { Provider } from '@/lib/types';

export type ProviderMapProps = {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  userLocation?: { latitude: number; longitude: number } | null;
  fitRequestId?: number;
  centerOnUserRequestId?: number;
  selectedCategoryId?: number | null;
  ratingByProvider?: Record<string, { average: number; count: number }>;
};

type ProviderMapFallbackProps = ProviderMapProps & {
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ProviderMapFallback({
  providers,
  selectedProviderId,
  onSelectProvider,
  description,
  actionLabel,
  onAction,
  selectedCategoryId = null,
  ratingByProvider = {},
}: ProviderMapFallbackProps) {
  return (
    <ScrollView
      accessibilityLabel="Service provider locations"
      contentContainerStyle={[
        styles.content,
        selectedCategoryId !== null && styles.contentWithResultsSheet,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      testID="provider-map-fallback"
    >
      <View style={styles.notice}>
        <View style={styles.noticeIcon}>
          <Ionicons name="map-outline" size={24} color={Colors.primary} />
        </View>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeEyebrow}>LOCATION BROWSER</Text>
          <Text style={styles.noticeTitle}>Explore services by area</Text>
          <Text style={styles.noticeText}>{description}</Text>
          {actionLabel && onAction ? (
            <Pressable
              accessibilityRole="button"
              onPress={onAction}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Ionicons name="refresh" size={16} color={Colors.primary} />
              <Text style={styles.retryText}>{actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {providers.length ? (
        <View style={styles.locations}>
          {providers.map((provider) => {
            const selected = provider.id === selectedProviderId;
            const category = getCategory(provider.categoryId);
            const rating = ratingByProvider[provider.id];

            return (
              <Pressable
                key={provider.id}
                accessibilityRole="button"
                accessibilityLabel={`Select ${provider.name} in ${provider.area}`}
                accessibilityState={{ selected }}
                onPress={() => onSelectProvider(provider.id)}
                style={({ pressed }) => [
                  styles.locationCard,
                  selected && styles.locationCardSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.pin, selected && styles.pinSelected]}>
                  <Ionicons
                    name={
                      (category?.icon ?? 'location-outline') as ComponentProps<
                        typeof Ionicons
                      >['name']
                    }
                    size={19}
                    color={selected ? Colors.textOnPrimary : Colors.primary}
                  />
                </View>
                <View style={styles.locationCopy}>
                  <Text style={styles.providerName} numberOfLines={1}>
                    {provider.name}
                  </Text>
                  <Text style={styles.providerMeta} numberOfLines={1}>
                    {selectedCategoryId !== null && rating?.count
                      ? `${rating.average.toFixed(1)} ★ · `
                      : ''}
                    {category?.name ?? 'Local service'} · {provider.area}
                  </Text>
                  <Text style={styles.providerAddress} numberOfLines={1}>
                    {provider.address}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'chevron-forward'}
                  size={19}
                  color={selected ? Colors.primary : Colors.textSubtle}
                />
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="location-outline" size={26} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No mapped services yet</Text>
          <Text style={styles.emptyText}>
            Published providers with a saved latitude and longitude will appear here.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: 140,
    paddingBottom: 250,
    backgroundColor: Colors.background,
  },
  contentWithResultsSheet: { paddingBottom: 380 },
  notice: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    borderCurve: 'continuous',
    backgroundColor: Colors.primarySoft,
  },
  noticeIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  noticeCopy: { flex: 1, gap: Spacing.xs },
  noticeEyebrow: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  noticeTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  noticeText: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  retryButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  retryText: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  locations: { gap: Spacing.sm },
  locationCard: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  locationCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  pin: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
  },
  pinSelected: { backgroundColor: Colors.primary },
  locationCopy: { flex: 1, gap: 2 },
  providerName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  providerMeta: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '700' },
  providerAddress: { color: Colors.textMuted, fontSize: FontSize.xs },
  emptyState: {
    flex: 1,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 29,
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  emptyText: {
    maxWidth: 300,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  pressed: { opacity: 0.74 },
});
