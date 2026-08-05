import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProviderMap from '../components/provider-map';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/mockData';
import type { Provider } from '@/lib/types';
import { useMarketplace } from '@/providers/MarketplaceProvider';

export default function ProviderMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ providerId?: string }>();
  const { getRatingForProvider, providers } = useMarketplace();
  const mappableProviders = useMemo(
    () => providers.filter(hasCoordinates),
    [providers]
  );
  const initialProviderId = mappableProviders.some(
    (provider) => provider.id === params.providerId
  )
    ? params.providerId!
    : null;
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(initialProviderId);
  const selectedProvider =
    mappableProviders.find((provider) => provider.id === selectedProviderId) ?? null;
  const rating = selectedProvider ? getRatingForProvider(selectedProvider.id) : null;

  const openDirections = async () => {
    if (!selectedProvider) return;

    const coordinates = `${selectedProvider.latitude},${selectedProvider.longitude}`;
    const label = encodeURIComponent(selectedProvider.name);
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${coordinates}`,
      android: `geo:${coordinates}?q=${coordinates}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${coordinates}`,
    });

    if (url) await Linking.openURL(url);
  };

  return (
    <View style={styles.screen}>
      <ProviderMap
        providers={mappableProviders}
        selectedProviderId={selectedProviderId}
        onSelectProvider={setSelectedProviderId}
      />

      <View style={styles.mapToolbar}>
        <View style={styles.mapSummary}>
          <Ionicons name="location" size={18} color={Colors.primary} />
          <Text style={styles.mapSummaryText}>
            {mappableProviders.length} service locations
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View services as a list"
          onPress={() => router.push('/search')}
          style={({ pressed }) => [styles.listButton, pressed && styles.pressed]}
        >
          <Ionicons name="list" size={17} color={Colors.primary} />
          <Text style={styles.listButtonText}>List</Text>
        </Pressable>
      </View>

      <View style={[styles.bottomPanel, { bottom: Math.max(insets.bottom, Spacing.md) }]}>
        {selectedProvider ? (
          <>
            <View style={styles.providerHeading}>
              <View style={styles.providerCopy}>
                <Text style={styles.providerName} numberOfLines={1}>
                  {selectedProvider.name}
                </Text>
                <Text style={styles.providerMeta} numberOfLines={1}>
                  {getCategory(selectedProvider.categoryId)?.name ?? 'Local service'} ·{' '}
                  {selectedProvider.area}
                </Text>
              </View>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color={Colors.star} />
                <Text style={styles.ratingText}>
                  {rating?.count ? rating.average.toFixed(1) : 'New'}
                </Text>
              </View>
            </View>
            <Text style={styles.address} numberOfLines={1}>
              {selectedProvider.address}
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Get directions to ${selectedProvider.name}`}
                onPress={() => void openDirections()}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
                <Text style={styles.secondaryButtonText}>Directions</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${selectedProvider.name}`}
                onPress={() => router.push(`/provider/${selectedProvider.id}`)}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>View service</Text>
                <Ionicons name="arrow-forward" size={17} color={Colors.textOnPrimary} />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptySelection}>
            <View style={styles.emptyIcon}>
              <Ionicons name="map-outline" size={22} color={Colors.primary} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyTitle}>Explore services nearby</Text>
              <Text style={styles.emptyText}>Tap a map pin or location to see provider details.</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function hasCoordinates(
  provider: Provider
): provider is Provider & { latitude: number; longitude: number } {
  return provider.latitude !== null && provider.longitude !== null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  mapToolbar: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    left: Spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  mapSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  mapSummaryText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  listButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  listButtonText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  bottomPanel: {
    position: 'absolute',
    right: Spacing.md,
    left: Spacing.md,
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  providerHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  providerCopy: { flex: 1, gap: 3 },
  providerName: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  providerMeta: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '700' },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  ratingText: { color: Colors.text, fontSize: FontSize.xs, fontWeight: '900' },
  address: { color: Colors.textMuted, fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  secondaryButton: {
    minHeight: 46,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  primaryButton: {
    minHeight: 46,
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  emptySelection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emptyIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
  },
  emptyCopy: { flex: 1, gap: 2 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  pressed: { opacity: 0.75 },
});
