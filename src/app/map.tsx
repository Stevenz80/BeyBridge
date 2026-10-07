import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Text from '@/components/localized-text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import FilterChip from '@/components/filter-chip';
import MapResultsSheet, {
  getMapSheetMetrics,
  type MapSheetResult,
  type MapSortMode,
} from '@/components/map-results-sheet';
import ProviderMap from '@/components/provider-map';
import type {
  MapViewport,
  MapViewportPadding,
} from '@/components/provider-map-fallback';
import SearchBar from '@/components/SearchBar';
import MarketplaceStatus from '@/components/marketplace-status';
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
import { openDirectionsTo } from '@/lib/directions';
import { useMarketplace } from '@/providers/MarketplaceProvider';
import { useLocalization } from '@/providers/LocalizationProvider';

type MappableProvider = Provider & { latitude: number; longitude: number };

export default function ProviderMapScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [interactiveMapAvailable, setInteractiveMapAvailable] = useState(false);
  const params = useLocalSearchParams<{
    providerId?: string;
    categoryId?: string;
    query?: string;
  }>();
  const { getRatingForProvider, providers, providersLoading, providersError } = useMarketplace();
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
  const [browseAllResults, setBrowseAllResults] = useState(false);
  const [sheetVisibleHeight, setSheetVisibleHeight] = useState<number | null>(null);
  const [selectionRequestId, setSelectionRequestId] = useState(0);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(0);
  const [fitRequestId, setFitRequestId] = useState(0);
  const [centerOnUserRequestId, setCenterOnUserRequestId] = useState(0);
  const [pendingViewport, setPendingViewport] = useState<MapViewport | null>(null);
  const [appliedViewportBounds, setAppliedViewportBounds] = useState<
    MapViewport['bounds'] | null
  >(null);
  const [viewportSearchPending, setViewportSearchPending] = useState(false);
  const queryFitInitialized = useRef(false);

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

  useEffect(() => {
    if (!queryFitInitialized.current) {
      queryFitInitialized.current = true;
      return;
    }

    const timeout = setTimeout(
      () => setFitRequestId((requestId) => requestId + 1),
      260
    );
    return () => clearTimeout(timeout);
  }, [searchAnalysis.normalizedQuery]);

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

  const rankedResults = useMemo<MapSheetResult[]>(() => {
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

  const results = useMemo(
    () =>
      appliedViewportBounds
        ? rankedResults.filter(({ provider }) =>
            isProviderWithinBounds(provider, appliedViewportBounds)
          )
        : rankedResults,
    [appliedViewportBounds, rankedResults]
  );

  const pendingViewportResultCount = useMemo(
    () =>
      pendingViewport
        ? rankedResults.filter(({ provider }) =>
            isProviderWithinBounds(provider, pendingViewport.bounds)
          ).length
        : 0,
    [pendingViewport, rankedResults]
  );

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
  const hasSelectedProvider = selectedProvider !== null;
  const selectedCategory =
    selectedCategoryId === null ? null : getCategory(selectedCategoryId) ?? null;
  const inferredCategory = searchAnalysis.categoryIds[0]
    ? getCategory(searchAnalysis.categoryIds[0]) ?? null
    : null;
  const showResultsSheet = Boolean(
    selectedCategory || searchAnalysis.normalizedQuery || appliedViewportBounds || browseAllResults
  );
  const resultsSheetTitle = selectedCategory
    ? selectedCategory.name
    : searchAnalysis.label
      ? searchAnalysis.label
      : query.trim() ? `Results for “${query.trim()}”` : 'All services';
  const resultsSheetIcon = (selectedCategory?.icon ??
    inferredCategory?.icon ??
    'search-outline') as ComponentProps<typeof Ionicons>['name'];
  const mapSheetMetrics = getMapSheetMetrics(windowHeight, insets.bottom);
  const mapViewportPadding = useMemo<MapViewportPadding>(() => {
    const safeTop = Math.max(insets.top, Spacing.sm) + Spacing.xs;
    const topOverlayHeight = sheetExpanded
      ? 48 + Spacing.md
      : 48 + Spacing.sm + 48 + (viewportSearchPending ? 48 : 0) + Spacing.md;
    const bottomOverlayHeight = showResultsSheet
      ? (sheetVisibleHeight ?? mapSheetMetrics.restingHeight) + Spacing.md
      : Math.max(bottomPanelHeight, hasSelectedProvider ? 260 : 80) +
        Math.max(insets.bottom, Spacing.md) +
        Spacing.md;

    return {
      top: safeTop + topOverlayHeight,
      right: 32,
      bottom: bottomOverlayHeight,
      left: 32,
    };
  }, [
    bottomPanelHeight,
    insets.bottom,
    insets.top,
    mapSheetMetrics.restingHeight,
    sheetVisibleHeight,
    hasSelectedProvider,
    sheetExpanded,
    showResultsSheet,
    viewportSearchPending,
  ]);

  const clearViewportSearch = useCallback(() => {
    setPendingViewport(null);
    setAppliedViewportBounds(null);
    setViewportSearchPending(false);
  }, []);

  const handleMapInteraction = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const selectProvider = useCallback((providerId: string) => {
    Keyboard.dismiss();
    setSelectedProviderId(providerId);
    setSelectionRequestId((requestId) => requestId + 1);
  }, []);

  const handleMapPress = useCallback(() => {
    Keyboard.dismiss();
    setSelectedProviderId(null);
  }, []);

  const handleViewportChange = useCallback((viewport: MapViewport) => {
    setPendingViewport(viewport);
    setViewportSearchPending(true);
  }, []);

  const searchCurrentViewport = () => {
    if (!pendingViewport) return;
    Keyboard.dismiss();
    setSelectedProviderId(null);
    setAppliedViewportBounds(pendingViewport.bounds);
    setViewportSearchPending(false);
    setSheetExpanded(false);
  };
  const openDirections = async () => {
    if (!selectedProvider || !hasCoordinates(selectedProvider)) return;
    try {
      await openDirectionsTo(selectedProvider);
    } catch {
      Alert.alert(t('Could not open directions'), t('Try again or use the service address in your maps app.'));
    }
  };

  const openProvider = useCallback(
    (providerId: string) => router.push(`/provider/${providerId}`),
    [router]
  );

  const chooseCategory = (categoryId: number | null) => {
    Keyboard.dismiss();
    clearViewportSearch();
    setSheetExpanded(false);
    setBrowseAllResults(categoryId === null);
    setSheetVisibleHeight(null);
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
  };

  const toggleOpenNow = () => {
    setSelectedProviderId(null);
    setOpenNowOnly((current) => !current);
  };

  const toggleVerified = () => {
    setSelectedProviderId(null);
    setVerifiedOnly((current) => !current);
  };

  const clearRefinements = () => {
    clearViewportSearch();
    setSelectedProviderId(null);
    setOpenNowOnly(false);
    setVerifiedOnly(false);
    setSortMode('recommended');
    setPriceSortDirection(null);
    setFitRequestId((requestId) => requestId + 1);
  };

  const centerOnUser = async () => {
    Keyboard.dismiss();
    const nextLocation = coordinates ?? (await requestLocation());
    if (nextLocation) setCenterOnUserRequestId((requestId) => requestId + 1);
  };

  const showAllResults = () => {
    clearViewportSearch();
    setSelectedProviderId(null);
    setFitRequestId((requestId) => requestId + 1);
  };

  const updateBottomPanelHeight = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setBottomPanelHeight((currentHeight) =>
      Math.abs(currentHeight - nextHeight) < 1 ? currentHeight : nextHeight
    );
  };

  const changeQuery = (nextQuery: string) => {
    clearViewportSearch();
    setQuery(nextQuery);
    setSelectedProviderId(null);
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
    setBrowseAllResults(false);
  };

  return (
    <View style={styles.screen}>
      <ProviderMap
        providers={visibleProviders}
        selectedProviderId={selectedProviderId}
        onSelectProvider={selectProvider}
        selectionRequestId={selectionRequestId}
        userLocation={coordinates}
        fitRequestId={fitRequestId}
        centerOnUserRequestId={centerOnUserRequestId}
        selectedCategoryId={selectedCategoryId}
        ratingByProvider={ratingByProvider}
        viewportPadding={mapViewportPadding}
        onMapInteraction={handleMapInteraction}
        onMapPress={handleMapPress}
        onViewportChange={handleViewportChange}
        onInteractiveMapReady={setInteractiveMapAvailable}
      />

      <View
        pointerEvents="box-none"
        style={[styles.topControls, { top: Math.max(insets.top, Spacing.sm) + Spacing.xs }]}
      >
        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back from service map"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={({ pressed }) => [styles.mapChromeButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </Pressable>

          {!sheetExpanded ? (
            <>
              <View style={styles.searchBarSlot}>
                <SearchBar
                  value={query}
                  onChangeText={changeQuery}
                  accessibilityLabel="Search services on the map"
                  placeholder="Search services"
                  testID="map-search"
                  compact
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View all ${results.length} filtered services as a list`}
                onPress={openList}
                style={({ pressed }) => [styles.mapChromeButton, pressed && styles.pressed]}
              >
                <Ionicons name="list" size={21} color={Colors.primary} />
              </Pressable>
            </>
          ) : null}
        </View>

        {!sheetExpanded ? (
          <>
            {providersLoading || providersError ? (
              <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.md }}>
                <MarketplaceStatus />
              </View>
            ) : null}
            <ScrollView
              horizontal
              accessibilityLabel="Filter by service type"
              style={styles.categoryScroller}
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

            {viewportSearchPending && pendingViewport ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Search this map area. ${pendingViewportResultCount} ${
                  pendingViewportResultCount === 1 ? 'service' : 'services'
                } currently in view`}
                onPress={searchCurrentViewport}
                style={({ pressed }) => [
                  styles.searchAreaButton,
                  pressed && styles.searchAreaButtonPressed,
                ]}
                testID="search-this-area"
              >
                <Ionicons name="search" size={17} color={Colors.primary} />
                <Text style={styles.searchAreaButtonText}>Search this area</Text>
              </Pressable>
            ) : null}

            {!showResultsSheet && locationError ? (
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
          key={selectedCategory?.id ?? (searchAnalysis.normalizedQuery ? 'search-results' : 'all-results')}
          title={resultsSheetTitle}
          titleIcon={resultsSheetIcon}
          results={results}
          selectedProviderId={selectedProviderId}
          selectionRequestId={selectionRequestId}
          sortMode={sortMode}
          priceSortDirection={priceSortDirection}
          openNowOnly={openNowOnly}
          verifiedOnly={verifiedOnly}
          locationLoading={locationLoading}
          locationError={locationError}
          emptyTitle={
            appliedViewportBounds ? 'No services in this map area' : undefined
          }
          emptyText={
            appliedViewportBounds
              ? 'Move the map or show all filtered services to widen your search.'
              : searchAnalysis.normalizedQuery
                ? 'Try another search or clear a filter.'
                : undefined
          }
          emptyActionLabel={
            appliedViewportBounds
              ? 'Show all filtered services'
              : searchAnalysis.normalizedQuery ? 'Clear search and filters' : undefined
          }
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
          onVisibleHeightChange={setSheetVisibleHeight}
          onSelectProvider={selectProvider}
          onOpenProvider={openProvider}
          onSortModeChange={(nextMode) => void chooseSortMode(nextMode)}
          onPriceSortDirectionChange={setPriceSortDirection}
          onToggleOpenNow={toggleOpenNow}
          onToggleVerified={toggleVerified}
          onClearRefinements={
            !appliedViewportBounds && searchAnalysis.normalizedQuery && results.length === 0
              ? () => { setQuery(''); chooseCategory(null); }
              : clearRefinements
          }
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
                    Math.max(insets.bottom, Spacing.md) +
                    Math.max(bottomPanelHeight, selectedProvider ? 304 : 96) +
                    Spacing.md,
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
          <View
            onLayout={updateBottomPanelHeight}
            style={[styles.bottomPanel, { bottom: Math.max(insets.bottom, Spacing.md) }]}
          >
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
                    {t(getCategory(selectedProvider.categoryId)?.name ?? 'Local service')} ·{' '}
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Close selected service')}
                  onPress={() => setSelectedProviderId(null)}
                  style={({ pressed }) => [styles.selectionCloseButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={20} color={Colors.text} />
                </Pressable>
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

function isProviderWithinBounds(
  provider: Provider,
  [west, south, east, north]: MapViewport['bounds']
) {
  if (!hasCoordinates(provider)) return false;
  const withinLatitude = provider.latitude >= south && provider.latitude <= north;
  const withinLongitude =
    west <= east
      ? provider.longitude >= west && provider.longitude <= east
      : provider.longitude >= west || provider.longitude <= east;
  return withinLatitude && withinLongitude;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topControls: {
    position: 'absolute',
    right: Spacing.md,
    left: Spacing.md,
    gap: Spacing.sm,
    zIndex: 3,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  searchBarSlot: {
    minWidth: 0,
    flex: 1,
    borderRadius: Radius.full,
    ...Shadows.card,
  },
  mapChromeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  categoryScroller: { flexGrow: 0, marginHorizontal: -Spacing.md },
  chipRow: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingBottom: 2,
  },
  searchAreaButton: {
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  searchAreaButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  searchAreaButtonText: {
    color: Colors.primaryDark,
    fontSize: FontSize.sm,
    fontWeight: '900',
  },
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
  selectionCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },
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
