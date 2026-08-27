import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { isRunningInExpoGo } from 'expo';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Text from '@/components/localized-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FilterChip from '@/components/filter-chip';
import MapResultsSheet, {
  type MapSheetResult,
  type MapSortMode,
} from '@/components/map-results-sheet';
import ProviderMap from '@/components/provider-map';
import SearchBar from '@/components/SearchBar';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { getDistanceKm, useUserLocation } from '@/hooks/use-user-location';
import { CATEGORIES, getCategory } from '@/lib/mockData';
import { getProviderOpenStatus } from '@/lib/provider-availability';
import {
  compareProviderPrices,
  formatCompactProviderPrice,
  type PriceSortDirection,
} from '@/lib/provider-pricing';
import {
  analyzeServiceSearch,
  getMinimumServiceSearchScore,
  scoreProviderForSearch,
} from '@/lib/service-search';
import type { Provider } from '@/lib/types';
import { useMarketplace } from '@/providers/MarketplaceProvider';

type MappableProvider = Provider & { latitude: number; longitude: number };

export default function ProviderMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const interactiveMapAvailable = Platform.OS !== 'web' && !isRunningInExpoGo();
  const params = useLocalSearchParams<{
    providerId?: string;
    categoryId?: string;
    query?: string;
  }>();
  const { getRatingForProvider, providers } = useMarketplace();
  const {
    coordinates,
    loading: locationLoading,
    error: locationError,
    requestLocation,
  } = useUserLocation();
  const requestedInitialLocation = useRef(false);
  const [selectionOverride, setSelectedProviderId] = useState<
    string | null | undefined
  >(undefined);
  const [query, setQuery] = useState(params.query ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(() => {
    const parsedCategoryId = params.categoryId ? Number(params.categoryId) : Number.NaN;
    return Number.isFinite(parsedCategoryId) ? parsedCategoryId : null;
  });
  const [sortMode, setSortMode] = useState<MapSortMode>('recommended');
  const [priceSortDirection, setPriceSortDirection] =
    useState<PriceSortDirection | null>(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [fitRequestId, setFitRequestId] = useState(0);
  const [centerOnUserRequestId, setCenterOnUserRequestId] = useState(0);

  useEffect(() => {
    if (!interactiveMapAvailable || requestedInitialLocation.current) return;

    requestedInitialLocation.current = true;
    void requestLocation();
  }, [interactiveMapAvailable, requestLocation]);

  const mappableProviders = useMemo(
    () => providers.filter(hasCoordinates),
    [providers]
  );
  const searchAnalysis = useMemo(() => analyzeServiceSearch(query), [query]);
  const minimumSearchScore = getMinimumServiceSearchScore(searchAnalysis);
  const searchCandidates = useMemo(
    () =>
      mappableProviders
        .map((provider) => ({
          provider,
          searchScore: scoreProviderForSearch(
            provider,
            getCategory(provider.categoryId),
            searchAnalysis
          ),
        }))
        .filter(
          ({ searchScore }) =>
            !searchAnalysis.normalizedQuery || searchScore >= minimumSearchScore
        ),
    [mappableProviders, minimumSearchScore, searchAnalysis]
  );
  const availableCategories = useMemo(() => {
    const categoryIds = new Set(
      searchCandidates.map(({ provider }) => provider.categoryId)
    );
    if (selectedCategoryId !== null) categoryIds.add(selectedCategoryId);
    return CATEGORIES.filter((category) => categoryIds.has(category.id));
  }, [searchCandidates, selectedCategoryId]);
  const ratingByProvider = useMemo(
    () =>
      Object.fromEntries(
        mappableProviders.map((provider) => {
          const liveRating = getRatingForProvider(provider.id);
          return [
            provider.id,
            liveRating.count
              ? liveRating
              : { average: provider.avgRating, count: provider.reviewCount },
          ];
        })
      ),
    [getRatingForProvider, mappableProviders]
  );

  const results = useMemo<MapSheetResult[]>(() => {
    return searchCandidates
      .map(({ provider, searchScore }) => ({
        provider,
        searchScore,
        rating: ratingByProvider[provider.id] ?? { average: 0, count: 0 },
        distanceKm: coordinates ? getDistanceKm(coordinates, provider) : null,
        openStatus: getProviderOpenStatus(provider),
      }))
      .filter(({ provider, openStatus }) => {
        if (selectedCategoryId !== null && provider.categoryId !== selectedCategoryId) {
          return false;
        }
        if (openNowOnly && !openStatus.isOpen) return false;
        return !verifiedOnly || Boolean(provider.isVerified);
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

        if (sortMode === 'distance' && coordinates) {
          return (a.distanceKm ?? Number.POSITIVE_INFINITY) -
            (b.distanceKm ?? Number.POSITIVE_INFINITY);
        }
        if (sortMode === 'rating') {
          return (
            b.rating.average - a.rating.average ||
            b.rating.count - a.rating.count ||
            a.provider.name.localeCompare(b.provider.name)
          );
        }
        if (searchAnalysis.normalizedQuery && a.searchScore !== b.searchScore) {
          return b.searchScore - a.searchScore;
        }
        return (
          getRecommendationScore(b.provider, b.rating) -
            getRecommendationScore(a.provider, a.rating) ||
          a.provider.name.localeCompare(b.provider.name)
        );
      });
  }, [
    coordinates,
    openNowOnly,
    priceSortDirection,
    ratingByProvider,
    searchAnalysis.normalizedQuery,
    searchCandidates,
    selectedCategoryId,
    sortMode,
    verifiedOnly,
  ]);

  const visibleProviders = useMemo(
    () => results.map(({ provider }) => provider),
    [results]
  );
  const requestedProviderId =
    params.providerId &&
    visibleProviders.some((provider) => provider.id === params.providerId)
      ? params.providerId
      : null;
  const selectedProviderId =
    selectionOverride === undefined
      ? requestedProviderId
      : selectionOverride &&
          visibleProviders.some((provider) => provider.id === selectionOverride)
        ? selectionOverride
        : null;
  const selectedResult =
    results.find(({ provider }) => provider.id === selectedProviderId) ?? null;
  const selectedProvider = selectedResult?.provider ?? null;
  const selectedCategory =
    selectedCategoryId === null ? null : getCategory(selectedCategoryId) ?? null;
  const inferredCategory = searchAnalysis.categoryIds[0]
    ? getCategory(searchAnalysis.categoryIds[0]) ?? null
    : null;
  const showResultsSheet = Boolean(selectedCategory || searchAnalysis.normalizedQuery);
  const resultsSheetTitle = selectedCategory
    ? `${selectedCategory.name} nearby`
    : searchAnalysis.label
      ? `${searchAnalysis.label} nearby`
      : `Results for “${query.trim()}”`;
  const resultsSheetIcon = (selectedCategory?.icon ??
    inferredCategory?.icon ??
    'search-outline') as ComponentProps<typeof Ionicons>['name'];
  const openDirections = async () => {
    if (!selectedProvider) return;

    const destination = `${selectedProvider.latitude},${selectedProvider.longitude}`;
    const label = encodeURIComponent(selectedProvider.name);
    const url = Platform.select({
      ios: `maps://?q=${label}&ll=${destination}`,
      android: `geo:${destination}?q=${destination}(${label})`,
      default: `https://www.google.com/maps/search/?api=1&query=${destination}`,
    });

    if (url) await Linking.openURL(url);
  };

  const chooseCategory = (categoryId: number | null) => {
    setSheetExpanded(false);
    setSelectedProviderId(null);
    setSelectedCategoryId(categoryId);
    if (categoryId === null) {
      setSortMode('recommended');
      setPriceSortDirection(null);
      setOpenNowOnly(false);
      setVerifiedOnly(false);
    }
    setFitRequestId((requestId) => requestId + 1);
  };

  const chooseSortMode = async (nextMode: MapSortMode) => {
    if (nextMode === 'distance' && !coordinates) {
      const nextLocation = await requestLocation();
      if (!nextLocation) return;
    }
    setSelectedProviderId(null);
    setSortMode(nextMode);
    setFitRequestId((requestId) => requestId + 1);
  };

  const toggleOpenNow = () => {
    setSelectedProviderId(null);
    setOpenNowOnly((current) => !current);
    setFitRequestId((requestId) => requestId + 1);
  };

  const toggleVerified = () => {
    setSelectedProviderId(null);
    setVerifiedOnly((current) => !current);
    setFitRequestId((requestId) => requestId + 1);
  };

  const clearRefinements = () => {
    setSelectedProviderId(null);
    setOpenNowOnly(false);
    setVerifiedOnly(false);
    setSortMode('recommended');
    setPriceSortDirection(null);
    setFitRequestId((requestId) => requestId + 1);
  };

  const centerOnUser = async () => {
    const nextLocation = coordinates ?? (await requestLocation());
    if (nextLocation) setCenterOnUserRequestId((requestId) => requestId + 1);
  };

  const showAllResults = () => {
    setSelectedProviderId(null);
    setFitRequestId((requestId) => requestId + 1);
  };

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setSelectedProviderId(null);
    setFitRequestId((requestId) => requestId + 1);
  };

  const openList = () => {
    const listParams: { query?: string; categoryId?: string } = {};
    if (query.trim()) listParams.query = query.trim();
    if (selectedCategoryId !== null) {
      listParams.categoryId = String(selectedCategoryId);
    }
    router.push({ pathname: '/search', params: listParams });
  };

  const closeResults = () => {
    setSheetExpanded(false);
    setQuery('');
    chooseCategory(null);
  };

  return (
    <View style={styles.screen}>
      <ProviderMap
        providers={visibleProviders}
        selectedProviderId={selectedProviderId}
        onSelectProvider={setSelectedProviderId}
        userLocation={coordinates}
        fitRequestId={fitRequestId}
        centerOnUserRequestId={centerOnUserRequestId}
        selectedCategoryId={selectedCategoryId}
        ratingByProvider={ratingByProvider}
      />

      <View style={[styles.topControls, sheetExpanded && styles.topControlsCompact]}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBarSlot, sheetExpanded && styles.compactSearchSurface]}>
            <SearchBar
              value={query}
              onChangeText={changeQuery}
              accessibilityLabel="Search services on the map"
              placeholder={'Try “flat tire” or “leaking sink”'}
              testID="map-search"
              compact={sheetExpanded}
            />
          </View>
          {sheetExpanded ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View all ${results.length} filtered services as a list`}
              onPress={openList}
              style={({ pressed }) => [styles.compactListButton, pressed && styles.pressed]}
            >
              <Ionicons name="list" size={19} color={Colors.primary} />
              <Text style={styles.compactListCount}>{results.length}</Text>
            </Pressable>
          ) : null}
        </View>

        {!sheetExpanded ? (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.mapSummary}>
                <Ionicons name="location" size={18} color={Colors.primary} />
                <Text style={styles.mapSummaryText}>
                  {results.length}{' '}
                  {results.length === 1 ? 'service location' : 'service locations'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View filtered services as a full list"
                onPress={openList}
                style={({ pressed }) => [styles.listButton, pressed && styles.pressed]}
              >
                <Ionicons name="list" size={17} color={Colors.primary} />
                <Text style={styles.listButtonText}>List</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              accessibilityLabel="Filter by service type"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <MapChip
                label="All services"
                icon="apps-outline"
                active={selectedCategoryId === null}
                onPress={() => chooseCategory(null)}
              />
              {availableCategories.map((category) => (
                <MapChip
                  key={category.id}
                  label={category.name}
                  icon={category.icon as ComponentProps<typeof Ionicons>['name']}
                  active={selectedCategoryId === category.id}
                  onPress={() => chooseCategory(category.id)}
                />
              ))}
            </ScrollView>

            {selectedCategoryId === null && locationError ? (
              <View accessibilityLiveRegion="polite" style={styles.locationError}>
                <Ionicons name="location-outline" size={16} color={Colors.danger} />
                <Text style={styles.locationErrorText} numberOfLines={2}>
                  {locationError}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {showResultsSheet ? (
        <MapResultsSheet
          key={selectedCategory?.id ?? 'search-results'}
          title={resultsSheetTitle}
          titleIcon={resultsSheetIcon}
          results={results}
          selectedProviderId={selectedProviderId}
          sortMode={sortMode}
          priceSortDirection={priceSortDirection}
          openNowOnly={openNowOnly}
          verifiedOnly={verifiedOnly}
          locationLoading={locationLoading}
          locationError={locationError}
          bottomInset={insets.bottom}
          floatingControls={
            interactiveMapAvailable ? (
              <MapCameraControls
                locationLoading={locationLoading}
                onCenter={() => void centerOnUser()}
                onShowAll={showAllResults}
              />
            ) : null
          }
          onExpandedChange={setSheetExpanded}
          onSelectProvider={setSelectedProviderId}
          onOpenProvider={(providerId) => router.push(`/provider/${providerId}`)}
          onSortModeChange={(nextMode) => void chooseSortMode(nextMode)}
          onPriceSortDirectionChange={setPriceSortDirection}
          onToggleOpenNow={toggleOpenNow}
          onToggleVerified={toggleVerified}
          onClearRefinements={clearRefinements}
          onClose={closeResults}
        />
      ) : (
        <>
          {interactiveMapAvailable ? (
            <View
              style={[
                styles.standaloneCameraControls,
                {
                  bottom:
                    Math.max(insets.bottom, Spacing.md) + (selectedProvider ? 232 : 136),
                },
              ]}
            >
              <MapCameraControls
                locationLoading={locationLoading}
                onCenter={() => void centerOnUser()}
                onShowAll={showAllResults}
              />
            </View>
          ) : null}
          <View style={[styles.bottomPanel, { bottom: Math.max(insets.bottom, Spacing.md) }]}>
            {selectedProvider && selectedResult ? (
              <>
              <View style={styles.providerHeading}>
                <View style={styles.providerLogo}>
                  <Ionicons
                    name={
                      (getCategory(selectedProvider.categoryId)?.icon ??
                        'location-outline') as ComponentProps<typeof Ionicons>['name']
                    }
                    size={21}
                    color={Colors.primary}
                  />
                </View>
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
                    {selectedResult.rating.count
                      ? selectedResult.rating.average.toFixed(1)
                      : 'New'}
                  </Text>
                </View>
              </View>
              <Text style={styles.address} numberOfLines={1}>
                {selectedProvider.address}
              </Text>
              <View style={styles.providerSignals}>
                {selectedProvider.isVerified ? (
                  <View style={styles.signalBadge}>
                    <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
                    <Text style={styles.signalText}>Verified</Text>
                  </View>
                ) : null}
                <View style={styles.signalBadge}>
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={selectedResult.openStatus.isOpen ? Colors.success : Colors.textMuted}
                  />
                  <Text style={styles.signalText}>{selectedResult.openStatus.label}</Text>
                </View>
                <View style={styles.signalBadge}>
                  <Ionicons name="pricetag-outline" size={14} color={Colors.primary} />
                  <Text style={styles.signalText}>
                    {formatCompactProviderPrice(selectedProvider)}
                  </Text>
                </View>
                {selectedResult.distanceKm !== null ? (
                  <View style={styles.signalBadge}>
                    <Ionicons name="navigate" size={14} color={Colors.primary} />
                    <Text style={styles.signalText}>
                      {formatDistance(selectedResult.distanceKm)} away
                    </Text>
                  </View>
                ) : null}
              </View>
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
                  <Text style={styles.emptyTitle}>Explore services on the map</Text>
                  <Text style={styles.emptyText}>
                    Choose a category for ratings and a draggable results list.
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

function MapChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <FilterChip
      label={label}
      icon={icon}
      selected={active}
      tone="strong"
      onPress={onPress}
    />
  );
}

function MapControlButton({
  label,
  icon,
  loading = false,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.mapControlButton, pressed && styles.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : (
        <Ionicons name={icon} size={22} color={Colors.primary} />
      )}
    </Pressable>
  );
}

function MapCameraControls({
  locationLoading,
  onCenter,
  onShowAll,
}: {
  locationLoading: boolean;
  onCenter: () => void;
  onShowAll: () => void;
}) {
  return (
    <View style={styles.cameraControlsStack}>
      <MapControlButton
        label="Center map on my location"
        icon="locate-outline"
        loading={locationLoading}
        onPress={onCenter}
      />
      <MapControlButton
        label="Show all filtered services"
        icon="scan-outline"
        onPress={onShowAll}
      />
    </View>
  );
}

function getRecommendationScore(
  provider: Provider,
  rating: { average: number; count: number }
) {
  return (
    Number(Boolean(provider.isVerified)) * 5 +
    rating.average * 2 +
    Math.log1p(rating.count) * 0.8 +
    Number(Boolean(provider.emergencyService)) * 0.25
  );
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 100) * 10)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

function hasCoordinates(provider: Provider): provider is MappableProvider {
  return provider.latitude !== null && provider.longitude !== null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topControls: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    left: Spacing.md,
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  topControlsCompact: {
    gap: 0,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    boxShadow: 'none',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchBarSlot: { flex: 1 },
  compactSearchSurface: { borderRadius: Radius.full, ...Shadows.card },
  compactListButton: {
    height: 48,
    minWidth: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  compactListCount: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  summaryRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6 },
  mapSummaryText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  listButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  listButtonText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.sm },
  locationError: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerSoft,
  },
  locationErrorText: { flex: 1, color: Colors.danger, fontSize: FontSize.xs, lineHeight: 16 },
  standaloneCameraControls: { position: 'absolute', right: Spacing.md },
  cameraControlsStack: { gap: Spacing.sm },
  mapControlButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
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
  providerHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  providerLogo: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: Colors.primarySoft,
  },
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
  providerSignals: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  signalBadge: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },
  signalText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  secondaryButton: {
    minHeight: 48,
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
    minHeight: 48,
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
