import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ProviderCard from '../components/ProviderCard';
import SearchBar from '../components/SearchBar';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { getDistanceKm, useUserLocation } from '../hooks/use-user-location';
import { CATEGORIES, getCategory } from '../lib/mockData';
import type { Provider } from '../lib/types';
import { useMarketplace } from '../providers/MarketplaceProvider';

type SortMode = 'recommended' | 'rating' | 'distance';

export default function SearchScreen() {
  const router = useRouter();
  const { getRatingForProvider, providers } = useMarketplace();
  const params = useLocalSearchParams<{ query?: string; categoryId?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(
    params.categoryId ? Number(params.categoryId) : null
  );
  const [minRating, setMinRating] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('recommended');
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const {
    coordinates,
    loading: locationLoading,
    error: locationError,
    requestLocation,
    clearLocation,
  } = useUserLocation();

  const results = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return providers
      .map((provider) => ({
        provider,
        distanceKm:
          coordinates && provider.latitude !== null && provider.longitude !== null
            ? getDistanceKm(coordinates, {
                latitude: provider.latitude,
                longitude: provider.longitude,
              })
            : null,
      }))
      .filter(({ provider, distanceKm }) => {
        if (categoryId !== null && provider.categoryId !== categoryId) return false;
        if (minRating !== null && getRatingForProvider(provider.id).average < minRating) return false;
        if (coordinates && (distanceKm === null || distanceKm > nearbyRadius)) return false;
        if (!cleanQuery) return true;

        const searchable = [
          provider.name,
          provider.description,
          provider.area,
          provider.address,
          getCategory(provider.categoryId)?.name ?? '',
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(cleanQuery);
      })
      .sort((a, b) => {
        if ((sortMode === 'distance' || coordinates) && a.distanceKm !== b.distanceKm) {
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        }

        const aRating = getRatingForProvider(a.provider.id);
        const bRating = getRatingForProvider(b.provider.id);
        if (sortMode === 'rating') {
          return bRating.average - aRating.average || bRating.count - aRating.count;
        }

        return (
          Number(Boolean(b.provider.isVerified)) - Number(Boolean(a.provider.isVerified)) ||
          bRating.average - aRating.average ||
          bRating.count - aRating.count
        );
      });
  }, [
    categoryId,
    coordinates,
    getRatingForProvider,
    minRating,
    nearbyRadius,
    providers,
    query,
    sortMode,
  ]);

  const openProvider = (provider: Provider) => router.push(`/provider/${provider.id}`);

  const clearFilters = () => {
    setQuery('');
    setCategoryId(null);
    setMinRating(null);
    setSortMode('recommended');
    clearLocation();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search service or provider" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label={coordinates ? 'Near me on' : 'Near me'}
            active={Boolean(coordinates)}
            icon="navigate-outline"
            loading={locationLoading}
            onPress={() => {
              if (coordinates) {
                clearLocation();
                setSortMode('recommended');
              } else {
                void requestLocation().then((location) => {
                  if (location) setSortMode('distance');
                });
              }
            }}
          />
          <Chip label="All services" active={categoryId === null} onPress={() => setCategoryId(null)} />
          {CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.filterFooter}>
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? 'service' : 'services'} found
          </Text>
          <View style={styles.ratingFilters}>
            {[4, 4.5].map((rating) => (
              <Chip
                key={rating}
                label={`★ ${rating}+`}
                active={minRating === rating}
                compact
                onPress={() => setMinRating(minRating === rating ? null : rating)}
              />
            ))}
          </View>
        </View>

        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sortChips}
          >
            <Chip
              label="Recommended"
              compact
              active={sortMode === 'recommended' && !coordinates}
              onPress={() => {
                clearLocation();
                setSortMode('recommended');
              }}
            />
            <Chip
              label="Top rated"
              compact
              active={sortMode === 'rating' && !coordinates}
              onPress={() => {
                clearLocation();
                setSortMode('rating');
              }}
            />
            {coordinates
              ? [5, 10, 25].map((radius) => (
                  <Chip
                    key={radius}
                    label={`Within ${radius} km`}
                    compact
                    active={nearbyRadius === radius}
                    onPress={() => {
                      setNearbyRadius(radius);
                      setSortMode('distance');
                    }}
                  />
                ))
              : null}
          </ScrollView>
        </View>

        {locationError ? (
          <View style={styles.locationError}>
            <Ionicons name="location-outline" size={18} color={Colors.danger} />
            <Text style={styles.locationErrorText}>{locationError}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={results}
        keyExtractor={({ provider }) => provider.id}
        renderItem={({ item }) => (
          <ProviderCard
            provider={item.provider}
            distanceKm={item.distanceKm}
            onPress={openProvider}
          />
        )}
        contentContainerStyle={[styles.list, results.length === 0 && styles.emptyList]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={30} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No services found</Text>
            <Text style={styles.emptyText}>
              {coordinates
                ? 'Try a wider distance or clear one of your filters.'
                : 'Try another service name or clear one of your filters.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={clearFilters}
              style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
            >
              <Text style={styles.clearButtonText}>Clear filters</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  compact = false,
  icon,
  loading = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={active ? Colors.textOnPrimary : Colors.primary} />
      ) : icon ? (
        <Ionicons name={icon} size={16} color={active ? Colors.textOnPrimary : Colors.primary} />
      ) : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  filters: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.md },
  chip: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },
  chipCompact: { minHeight: 36, paddingHorizontal: 12 },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  chipLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  chipLabelActive: { color: Colors.textOnPrimary },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700' },
  ratingFilters: { flexDirection: 'row', gap: Spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sortLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '800' },
  sortChips: { gap: Spacing.sm, paddingRight: Spacing.md },
  locationError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerSoft,
  },
  locationErrorText: { flex: 1, color: Colors.danger, fontSize: FontSize.xs, lineHeight: 18 },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  emptyText: {
    maxWidth: 280,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  clearButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  clearButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
