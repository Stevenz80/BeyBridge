import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FilterChip from '../components/filter-chip';
import ProviderCard from '../components/ProviderCard';
import PriceSortPicker from '../components/price-sort-picker';
import SearchBar from '../components/SearchBar';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { getDistanceKm, useUserLocation } from '../hooks/use-user-location';
import { CATEGORIES, getCategory } from '../lib/mockData';
import {
  compareProviderPrices,
  type PriceSortDirection,
} from '../lib/provider-pricing';
import {
  analyzeServiceSearch,
  getMinimumServiceSearchScore,
  scoreProviderForSearch,
} from '../lib/service-search';
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
  const [priceSortDirection, setPriceSortDirection] =
    useState<PriceSortDirection | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState(10);
  const {
    coordinates,
    loading: locationLoading,
    error: locationError,
    requestLocation,
    clearLocation,
  } = useUserLocation();

  const searchAnalysis = useMemo(() => analyzeServiceSearch(query), [query]);
  const minimumSearchScore = getMinimumServiceSearchScore(searchAnalysis);
  const availableCategories = useMemo(() => {
    if (!searchAnalysis.normalizedQuery) return CATEGORIES;

    const matchingCategoryIds = new Set(
      providers
        .filter(
          (provider) =>
            scoreProviderForSearch(
              provider,
              getCategory(provider.categoryId),
              searchAnalysis
            ) >= minimumSearchScore
        )
        .map((provider) => provider.categoryId)
    );
    if (categoryId !== null) matchingCategoryIds.add(categoryId);
    return CATEGORIES.filter((category) => matchingCategoryIds.has(category.id));
  }, [categoryId, minimumSearchScore, providers, searchAnalysis]);
  const results = useMemo(() => {
    return providers
      .map((provider) => ({
        provider,
        searchScore: scoreProviderForSearch(
          provider,
          getCategory(provider.categoryId),
          searchAnalysis
        ),
        distanceKm:
          coordinates && provider.latitude !== null && provider.longitude !== null
            ? getDistanceKm(coordinates, {
                latitude: provider.latitude,
                longitude: provider.longitude,
              })
            : null,
      }))
      .filter(({ provider, distanceKm, searchScore }) => {
        if (categoryId !== null && provider.categoryId !== categoryId) return false;
        if (minRating !== null && getRatingForProvider(provider.id).average < minRating) return false;
        if (coordinates && (distanceKm === null || distanceKm > nearbyRadius)) return false;
        return !searchAnalysis.normalizedQuery || searchScore >= minimumSearchScore;
      })
      .sort((a, b) => {
        if (priceSortDirection) {
          const priceComparison = compareProviderPrices(
            a.provider,
            b.provider,
            priceSortDirection
          );
          if (priceComparison) return priceComparison;
        }

        if (sortMode === 'distance') {
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        }

        const aRating = getRatingForProvider(a.provider.id);
        const bRating = getRatingForProvider(b.provider.id);
        if (sortMode === 'rating') {
          return bRating.average - aRating.average || bRating.count - aRating.count;
        }
        if (searchAnalysis.normalizedQuery && a.searchScore !== b.searchScore) {
          return b.searchScore - a.searchScore;
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
    minimumSearchScore,
    nearbyRadius,
    providers,
    priceSortDirection,
    searchAnalysis,
    sortMode,
  ]);

  const openProvider = (provider: Provider) => router.push(`/provider/${provider.id}`);

  const clearFilters = () => {
    setQuery('');
    setCategoryId(null);
    setMinRating(null);
    setSortMode('recommended');
    setPriceSortDirection(null);
    clearLocation();
  };

  const mapParams: { query?: string; categoryId?: string } = {};
  if (query.trim()) mapParams.query = query.trim();
  if (categoryId !== null) mapParams.categoryId = String(categoryId);

  return (
    <View style={styles.screen}>
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
        ListHeaderComponent={
          <View style={styles.filters}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder={'Try “tire change” or “broken fridge”'}
            />

        {query.trim() && searchAnalysis.label ? (
          <View style={styles.intentBanner}>
            <Ionicons name="sparkles" size={16} color={Colors.primary} />
            <Text style={styles.intentText}>
              Matching <Text style={styles.intentStrong}>{searchAnalysis.label}</Text> and related services
            </Text>
          </View>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          <FilterChip
            label={coordinates ? 'Near me on' : 'Near me'}
            selected={Boolean(coordinates)}
            icon="navigate-outline"
            loading={locationLoading}
            tone="strong"
            onPress={() => {
              if (coordinates) {
                clearLocation();
                if (sortMode === 'distance') setSortMode('recommended');
              } else {
                void requestLocation().then((location) => {
                  if (location) setSortMode('distance');
                });
              }
            }}
          />
          <FilterChip
            label="All"
            selected={categoryId === null}
            tone="strong"
            onPress={() => setCategoryId(null)}
          />
          {availableCategories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              selected={categoryId === category.id}
              tone="strong"
              onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.optionsRow}
          keyboardShouldPersistTaps="handled"
        >
          <FilterChip
            label="Recommended"
            selected={sortMode === 'recommended'}
            onPress={() => setSortMode('recommended')}
          />
          <FilterChip
            label="Top rated"
            icon="star-outline"
            selected={sortMode === 'rating'}
            onPress={() => setSortMode('rating')}
          />
          <PriceSortPicker
            value={priceSortDirection}
            onChange={setPriceSortDirection}
            testID="search-price-sort"
          />
          {[4, 4.5].map((rating) => (
            <FilterChip
              key={rating}
              label={`${rating}+`}
              icon="star-outline"
              selected={minRating === rating}
              onPress={() => setMinRating(minRating === rating ? null : rating)}
            />
          ))}
          {coordinates
            ? [5, 10, 25].map((radius) => (
                <FilterChip
                  key={radius}
                  label={`${radius} km`}
                  icon="navigate-outline"
                  selected={nearbyRadius === radius && sortMode === 'distance'}
                  onPress={() => {
                    setNearbyRadius(radius);
                    setSortMode('distance');
                  }}
                />
              ))
            : null}
        </ScrollView>

        <View style={styles.filterFooter}>
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? 'service' : 'services'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View these services on the map"
            onPress={() => router.push({ pathname: '/map', params: mapParams })}
            style={({ pressed }) => [styles.mapButton, pressed && styles.pressed]}
          >
            <Ionicons name="map-outline" size={16} color={Colors.primary} />
            <Text style={styles.mapButtonText}>Map</Text>
          </Pressable>
        </View>

        {locationError ? (
          <View style={styles.locationError}>
            <Ionicons name="location-outline" size={18} color={Colors.danger} />
            <Text style={styles.locationErrorText}>{locationError}</Text>
          </View>
        ) : null}
          </View>
        }
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
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
                : 'Describe the problem another way or clear one of your filters.'}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  filters: {
    gap: Spacing.sm + 2,
    marginTop: -Spacing.md,
    marginHorizontal: -Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  intentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
  },
  intentText: { flex: 1, color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  intentStrong: { color: Colors.primaryDark, fontWeight: '900' },
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.md },
  optionsRow: { gap: Spacing.sm, paddingRight: Spacing.md },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700' },
  mapButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  mapButtonText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '900' },
  locationError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  locationErrorText: { flex: 1, color: Colors.danger, fontSize: FontSize.xs, lineHeight: 18 },
  list: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  empty: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl, paddingTop: Spacing.xxl },
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
    maxWidth: 290,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  clearButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  clearButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
