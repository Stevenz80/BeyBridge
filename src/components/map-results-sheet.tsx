import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Text from '@/components/localized-text';
import FilterChip from '@/components/filter-chip';
import PriceSortPicker from '@/components/price-sort-picker';

import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { ProviderOpenStatus } from '@/lib/provider-availability';
import {
  formatCompactProviderPrice,
  type PriceSortDirection,
} from '@/lib/provider-pricing';
import { getCategory } from '@/lib/mockData';
import type { Provider } from '@/lib/types';

export type MapSortMode = 'recommended' | 'distance' | 'rating';
type MapSheetDetent = 'expanded' | 'resting' | 'peek';

export type MapSheetResult = {
  provider: Provider;
  rating: { average: number; count: number };
  distanceKm: number | null;
  openStatus: ProviderOpenStatus;
};

type MapResultsSheetProps = {
  title: string;
  titleIcon: ComponentProps<typeof Ionicons>['name'];
  results: MapSheetResult[];
  selectedProviderId: string | null;
  selectionRequestId?: number;
  sortMode: MapSortMode;
  priceSortDirection: PriceSortDirection | null;
  openNowOnly: boolean;
  verifiedOnly: boolean;
  locationLoading: boolean;
  locationError: string | null;
  emptyTitle?: string;
  emptyText?: string;
  emptyActionLabel?: string;
  bottomInset: number;
  floatingControls?: ReactNode;
  onExpandedChange?: (expanded: boolean) => void;
  onVisibleHeightChange?: (height: number) => void;
  onSelectProvider: (providerId: string) => void;
  onOpenProvider: (providerId: string) => void;
  onSortModeChange: (mode: MapSortMode) => void;
  onPriceSortDirectionChange: (direction: PriceSortDirection | null) => void;
  onToggleOpenNow: () => void;
  onToggleVerified: () => void;
  onClearRefinements: () => void;
  onClose: () => void;
};

const SPRING_CONFIG = {
  duration: 300,
  dampingRatio: 0.8,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
} as const;

const FLING_VELOCITY = 600;
const MAX_RELEASE_VELOCITY = 2400;

async function triggerSheetDetentHaptic() {
  if (Platform.OS === 'web') return;

  try {
    if (Platform.OS === 'android') {
      await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics are optional feedback and may be disabled by device settings.
  }
}

export function getMapSheetMetrics(windowHeight: number, bottomInset: number) {
  const compactHeight = windowHeight < 500;
  const sheetHeight = Math.min(
    Math.max(windowHeight * 0.7, compactHeight ? 200 : 240),
    Math.max(160, windowHeight - 96),
    620
  );
  const restingHeight = compactHeight
    ? Math.min(sheetHeight, Math.max(windowHeight * 0.4, 152))
    : Math.min(sheetHeight, Math.min(Math.max(windowHeight * 0.38, 270), 330));
  const peekHeight = Math.min(
    restingHeight,
    compactHeight
      ? Math.max(104, Math.min(windowHeight * 0.3, 132))
      : Math.max(112, Math.min(104 + bottomInset, 144))
  );

  return {
    sheetHeight,
    restingHeight,
    peekHeight,
    restingOffset: Math.max(0, sheetHeight - restingHeight),
    peekOffset: Math.max(0, sheetHeight - peekHeight),
  };
}

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot));
}

function closestDetentIndex(offset: number, detents: readonly number[]) {
  'worklet';
  let closestIndex = 0;
  let closestDistance = Math.abs(offset - detents[0]);

  for (let index = 1; index < detents.length; index += 1) {
    const distance = Math.abs(offset - detents[index]);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  }

  return closestIndex;
}

function resolveReleaseVelocity(velocity: number) {
  'worklet';
  return Math.min(
    MAX_RELEASE_VELOCITY,
    Math.max(-MAX_RELEASE_VELOCITY, velocity)
  );
}

function resolveDetentTarget(
  offset: number,
  velocity: number,
  restingOffset: number,
  peekOffset: number
) {
  'worklet';
  const detents = [0, restingOffset, peekOffset] as const;
  const releaseVelocity = resolveReleaseVelocity(velocity);
  const projectedOffset = Math.min(
    peekOffset,
    Math.max(0, offset + project(releaseVelocity))
  );
  const projectedIndex = closestDetentIndex(projectedOffset, detents);

  if (Math.abs(releaseVelocity) < FLING_VELOCITY) {
    return detents[projectedIndex];
  }

  const currentIndex = closestDetentIndex(offset, detents);
  const directionalIndex = Math.min(
    detents.length - 1,
    Math.max(0, currentIndex + (releaseVelocity > 0 ? 1 : -1))
  );
  const targetIndex =
    releaseVelocity > 0
      ? Math.max(directionalIndex, projectedIndex)
      : Math.min(directionalIndex, projectedIndex);

  return detents[targetIndex];
}

export default function MapResultsSheet({
  title,
  titleIcon,
  results,
  selectedProviderId,
  selectionRequestId = 0,
  sortMode,
  priceSortDirection,
  openNowOnly,
  verifiedOnly,
  locationLoading,
  locationError,
  emptyTitle = 'No places match these filters',
  emptyText = 'Try showing closed or unverified providers.',
  emptyActionLabel = 'Clear filters',
  bottomInset,
  floatingControls,
  onExpandedChange,
  onVisibleHeightChange,
  onSelectProvider,
  onOpenProvider,
  onSortModeChange,
  onPriceSortDirectionChange,
  onToggleOpenNow,
  onToggleVerified,
  onClearRefinements,
  onClose,
}: MapResultsSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const { sheetHeight, restingOffset, peekOffset } = getMapSheetMetrics(
    windowHeight,
    bottomInset
  );
  const translateY = useSharedValue(sheetHeight);
  const gestureStart = useSharedValue(restingOffset);
  const resultListRef = useRef<FlatList<MapSheetResult>>(null);
  const [settledDetent, setSettledDetent] = useState<MapSheetDetent>('resting');
  const settledDetentRef = useRef<MapSheetDetent>('resting');
  const previousSelection = useRef<string | null>(null);
  const previousSelectionRequest = useRef(selectionRequestId);
  const reducedMotion = useReducedMotion();
  const settledOffset =
    settledDetent === 'expanded'
      ? 0
      : settledDetent === 'peek'
        ? peekOffset
        : restingOffset;

  useEffect(() => {
    settledDetentRef.current = settledDetent;
  }, [settledDetent]);

  useEffect(() => {
    onVisibleHeightChange?.(sheetHeight - settledOffset);
  }, [onVisibleHeightChange, settledOffset, sheetHeight]);

  // Only enter once or reposition after a viewport resize. A detent commit must
  // never restart the entrance animation after the finger's spring has settled.
  useEffect(() => {
    const detent = settledDetentRef.current;
    const target =
      detent === 'expanded'
        ? 0
        : detent === 'peek'
          ? peekOffset
          : restingOffset;
    translateY.set(withSpring(target, SPRING_CONFIG));
  }, [peekOffset, restingOffset, sheetHeight, translateY]);

  useEffect(() => {
    const changed = previousSelection.current !== selectedProviderId ||
      previousSelectionRequest.current !== selectionRequestId;
    previousSelection.current = selectedProviderId;
    previousSelectionRequest.current = selectionRequestId;
    if (!changed || !selectedProviderId || settledDetentRef.current === 'resting') return;

    setSettledDetent('resting');
    onExpandedChange?.(false);
    translateY.set(withSpring(restingOffset, SPRING_CONFIG));
  }, [onExpandedChange, restingOffset, selectedProviderId, selectionRequestId, translateY]);

  const selectedIndex = results.findIndex(
    ({ provider }) => provider.id === selectedProviderId
  );

  useEffect(() => {
    if (!selectedProviderId || selectedIndex < 0) return;

    const frame = requestAnimationFrame(() => {
      resultListRef.current?.scrollToIndex({
        animated: !reducedMotion,
        index: selectedIndex,
        viewPosition: 0.12,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, selectedIndex, selectedProviderId]);

  const listNativeGesture = useMemo(() => Gesture.Native(), []);
  const { footerPanGesture, headerGesture } = useMemo(() => {
    const createPanGesture = () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .failOffsetX([-24, 24])
        .onStart(() => {
          cancelAnimation(translateY);
          gestureStart.set(translateY.get());
        })
        .onUpdate((event) => {
          const nextOffset = gestureStart.get() + event.translationY;
          if (nextOffset < 0) {
            translateY.set(rubberband(nextOffset, sheetHeight));
            return;
          }
          if (nextOffset > peekOffset) {
            translateY.set(
              peekOffset + rubberband(nextOffset - peekOffset, sheetHeight)
            );
            return;
          }
          translateY.set(nextOffset);
        })
        .onEnd((event) => {
          const releaseVelocity = resolveReleaseVelocity(event.velocityY);
          const detents = [0, restingOffset, peekOffset] as const;
          const target = resolveDetentTarget(
            translateY.get(),
            event.velocityY,
            restingOffset,
            peekOffset
          );
          const detent: MapSheetDetent =
            target === 0 ? 'expanded' : target === peekOffset ? 'peek' : 'resting';
          if (target !== detents[closestDetentIndex(gestureStart.get(), detents)]) {
            scheduleOnRN(triggerSheetDetentHaptic);
          }
          translateY.set(
            withSpring(
              target,
              { ...SPRING_CONFIG, velocity: releaseVelocity },
              (finished) => {
                if (!finished) return;
                scheduleOnRN(setSettledDetent, detent);
                if (onExpandedChange) {
                  scheduleOnRN(onExpandedChange, target === 0);
                }
              }
            )
          );
        });

    const headerTapGesture = Gesture.Tap().onEnd((_event, success) => {
      if (!success) return;
      const target = translateY.get() < restingOffset / 2 ? restingOffset : 0;
      const detent: MapSheetDetent = target === 0 ? 'expanded' : 'resting';
      scheduleOnRN(triggerSheetDetentHaptic);
      translateY.set(withSpring(target, SPRING_CONFIG, (finished) => {
        if (!finished) return;
        scheduleOnRN(setSettledDetent, detent);
        if (onExpandedChange) scheduleOnRN(onExpandedChange, target === 0);
      }));
    });

    return {
      headerGesture: Gesture.Exclusive(createPanGesture(), headerTapGesture),
      footerPanGesture: createPanGesture().blocksExternalGesture(listNativeGesture),
    };
  }, [
    gestureStart,
    listNativeGesture,
    onExpandedChange,
    peekOffset,
    restingOffset,
    sheetHeight,
    translateY,
  ]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));
  const animatedSheetContentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [restingOffset, Math.max(restingOffset, peekOffset - 28), peekOffset],
      [1, 0.18, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateY: interpolate(
          translateY.get(),
          [restingOffset, peekOffset],
          [0, 8],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));
  const animatedFloatingControlsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.get(),
      [0, Math.max(24, restingOffset * 0.35), peekOffset],
      [0, 1, 1],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        translateX: interpolate(
          translateY.get(),
          [0, Math.max(24, restingOffset * 0.35)],
          [80, 0],
          Extrapolation.CLAMP
        ),
      },
      { translateY: translateY.get() },
    ],
  }));

  const toggleExpanded = () => {
    const target = translateY.get() < restingOffset / 2 ? restingOffset : 0;
    setSettledDetent(target === 0 ? 'expanded' : 'resting');
    onExpandedChange?.(target === 0);
    void triggerSheetDetentHaptic();
    translateY.set(withSpring(target, SPRING_CONFIG));
  };

  const footerDragArea =
    results.length > 0 ? (
      <GestureDetector gesture={footerPanGesture}>
        <View
          accessibilityLabel="Drag map results up or down"
          accessibilityHint="Swipe vertically to resize the results panel"
          style={[
            styles.footerDragArea,
            { minHeight: Math.max(96, bottomInset + 64) },
          ]}
        />
      </GestureDetector>
    ) : null;

  const resultList = (
    <FlatList
      ref={resultListRef}
      testID="map-results-list"
      style={styles.resultListViewport}
      data={results}
      extraData={selectedProviderId}
      keyExtractor={({ provider }) => provider.id}
      renderItem={({ item }) => (
        <ResultCard
          item={item}
          selected={item.provider.id === selectedProviderId}
          onSelect={onSelectProvider}
          onOpen={onOpenProvider}
        />
      )}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.resultList,
        results.length === 0 && styles.emptyResultList,
      ]}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={5}
      maxToRenderPerBatch={8}
      nestedScrollEnabled
      onScrollToIndexFailed={({ averageItemLength, index }) => {
        resultListRef.current?.scrollToOffset({
          animated: !reducedMotion,
          offset: Math.max(0, averageItemLength * index),
        });
      }}
      showsVerticalScrollIndicator={false}
      updateCellsBatchingPeriod={32}
      windowSize={7}
      ListFooterComponentStyle={styles.resultFooter}
      ListFooterComponent={footerDragArea}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="search-outline" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyText}>{emptyText}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClearRefinements}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <Text style={styles.clearButtonText}>{emptyActionLabel}</Text>
          </Pressable>
        </View>
      }
    />
  );

  return (
    <>
      {floatingControls ? (
        <Animated.View
          pointerEvents={settledDetent === 'expanded' ? 'none' : 'box-none'}
          aria-hidden={settledDetent === 'expanded'}
          accessibilityElementsHidden={settledDetent === 'expanded'}
          importantForAccessibility={settledDetent === 'expanded' ? 'no-hide-descendants' : 'auto'}
          style={[
            styles.floatingControls,
            { bottom: sheetHeight + Spacing.md },
            animatedFloatingControlsStyle,
          ]}
        >
          {floatingControls}
        </Animated.View>
      ) : null}

      <Animated.View
        accessibilityLabel={`${title} map results`}
        style={[styles.sheet, { height: sheetHeight }, animatedSheetStyle]}
        testID="map-results-sheet"
      >
        <GestureDetector gesture={headerGesture}>
          <View style={styles.grabSurface}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel="Expand or collapse map results"
              accessibilityHint="Drag vertically to show more or less of the map"
              accessibilityState={{ expanded: settledDetent === 'expanded' }}
              aria-expanded={settledDetent === 'expanded'}
              // Web keyboard handling leaves the gesture surface intact for dragging.
              {...(Platform.OS === 'web' ? {
                tabIndex: 0,
                onKeyDown: (event: React.KeyboardEvent) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  toggleExpanded();
                },
              } : {})}
              accessibilityActions={[{ name: 'activate', label: 'Expand or collapse' }]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'activate') toggleExpanded();
              }}
              style={styles.dragArea}
            >
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.sheetHeader}>
              <Ionicons name={titleIcon} size={20} color={Colors.primary} />
              <View style={styles.headerCopy}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.resultCount}>
                  {results.length} {results.length === 1 ? 'place' : 'places'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close map results"
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </Pressable>
            </View>
          </View>
        </GestureDetector>

        <Animated.View
          pointerEvents={settledDetent === 'peek' ? 'none' : 'auto'}
          aria-hidden={settledDetent === 'peek'}
          accessibilityElementsHidden={settledDetent === 'peek'}
          importantForAccessibility={settledDetent === 'peek' ? 'no-hide-descendants' : 'auto'}
          style={[
            styles.sheetContent,
            { paddingBottom: settledOffset },
            animatedSheetContentStyle,
          ]}
          testID="map-results-content"
        >
          <ScrollView
            horizontal
            accessibilityLabel="Sort and filter category results"
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroller}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label="Relevance"
              selected={sortMode === 'recommended'}
              onPress={() => onSortModeChange('recommended')}
            />
            <FilterChip
              label="Distance"
              icon="navigate-outline"
              selected={sortMode === 'distance'}
              loading={locationLoading}
              onPress={() => onSortModeChange('distance')}
            />
            <FilterChip
              label="Top rated"
              icon="star-outline"
              selected={sortMode === 'rating'}
              onPress={() => onSortModeChange('rating')}
            />
            <PriceSortPicker
              value={priceSortDirection}
              onChange={onPriceSortDirectionChange}
              testID="map-price-sort"
            />
            <FilterChip
              label="Open now"
              icon="time-outline"
              selected={openNowOnly}
              onPress={onToggleOpenNow}
            />
            <FilterChip
              label="Verified"
              icon="shield-checkmark-outline"
              selected={verifiedOnly}
              onPress={onToggleVerified}
            />
          </ScrollView>

          {locationError ? (
            <View accessibilityLiveRegion="polite" style={styles.locationError}>
              <Ionicons name="location-outline" size={16} color={Colors.danger} />
              <Text style={styles.locationErrorText} numberOfLines={2}>
                {locationError}
              </Text>
            </View>
          ) : null}

          {Platform.OS === 'web' ? (
            resultList
          ) : (
            <GestureDetector gesture={listNativeGesture}>{resultList}</GestureDetector>
          )}
        </Animated.View>
      </Animated.View>
    </>
  );
}

const ResultCard = memo(function ResultCard({
  item,
  selected,
  onSelect,
  onOpen,
}: {
  item: MapSheetResult;
  selected: boolean;
  onSelect: (providerId: string) => void;
  onOpen: (providerId: string) => void;
}) {
  const { provider, rating, distanceKm, openStatus } = item;
  const providerIcon = (getCategory(provider.categoryId)?.icon ??
    'location-outline') as ComponentProps<typeof Ionicons>['name'];

  return (
    <View style={[styles.resultCard, selected && styles.resultCardSelected]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Show ${provider.name} on map`}
        accessibilityState={{ selected }}
        aria-selected={selected}
        onPress={() => onSelect(provider.id)}
        style={({ pressed }) => [styles.resultMain, pressed && styles.pressed]}
      >
        <View style={[styles.providerIcon, selected && styles.providerIconSelected]}>
          <Ionicons
            name={providerIcon}
            size={23}
            color={selected ? Colors.textOnPrimary : Colors.primary}
          />
        </View>
        <View style={styles.providerCopy}>
          <View style={styles.providerTitleRow}>
            <Text style={styles.providerName} numberOfLines={1}>
              {provider.name}
            </Text>
            {provider.isVerified ? (
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            ) : null}
          </View>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingText}>
              {rating.count ? rating.average.toFixed(1) : 'New'}
            </Text>
            <Ionicons name="star" size={13} color={Colors.star} />
            {rating.count ? <Text style={styles.reviewCount}>({rating.count})</Text> : null}
          </View>
          <Text style={styles.providerMeta} numberOfLines={1}>
            {provider.area}
            {distanceKm !== null ? ` · ${formatDistance(distanceKm)}` : ''}
          </Text>
          <View style={styles.providerSignals}>
            <Text
              style={[
                styles.openStatus,
                openStatus.isOpen ? styles.openStatusActive : styles.openStatusClosed,
              ]}
            >
              {openStatus.label}
            </Text>
            <Text style={styles.signalSeparator}>·</Text>
            <View style={styles.priceSignal}>
              <Ionicons name="pricetag-outline" size={12} color={Colors.primaryDark} />
              <Text style={styles.priceText}>{formatCompactProviderPrice(provider)}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${provider.name}`}
        onPress={() => onOpen(provider.id)}
        style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
      </Pressable>
    </View>
  );
});

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.max(10, Math.round(distanceKm * 100) * 10)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
    zIndex: 2,
    ...Shadows.card,
  },
  floatingControls: {
    position: 'absolute',
    right: Spacing.md,
    zIndex: 1,
  },
  grabSurface: { backgroundColor: Colors.surface },
  sheetContent: { flex: 1 },
  dragArea: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 54,
    height: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.borderStrong,
  },
  sheetHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  headerCopy: { flex: 1, gap: 1 },
  sheetTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', letterSpacing: -0.2 },
  resultCount: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.background,
  },
  filterRow: { gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  filterScroller: {
    flexGrow: 0,
    maxHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  locationError: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.dangerSoft,
  },
  locationErrorText: { flex: 1, color: Colors.danger, fontSize: FontSize.xs, lineHeight: 16 },
  resultList: {
    flexGrow: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
  },
  resultListViewport: { flex: 1 },
  resultFooter: { flexGrow: 1 },
  footerDragArea: { flex: 1 },
  emptyResultList: { flexGrow: 1 },
  resultCard: {
    minHeight: 100,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  resultCardSelected: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    borderCurve: 'continuous',
    backgroundColor: Colors.primarySoft,
  },
  resultMain: {
    minHeight: 98,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  providerIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
  },
  providerIconSelected: { backgroundColor: Colors.primary },
  providerCopy: { flex: 1, gap: 3 },
  providerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  providerName: { flexShrink: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { color: Colors.text, fontSize: FontSize.xs, fontWeight: '900' },
  reviewCount: { color: Colors.textMuted, fontSize: FontSize.xs },
  providerMeta: { color: Colors.textMuted, fontSize: FontSize.xs },
  providerSignals: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  signalSeparator: { color: Colors.textMuted, fontSize: FontSize.xs },
  priceSignal: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  priceText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800' },
  openStatus: { fontSize: FontSize.xs, fontWeight: '800' },
  openStatusActive: { color: Colors.success },
  openStatusClosed: { color: Colors.textMuted },
  openButton: {
    width: 46,
    minHeight: 98,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center' },
  clearButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  clearButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.xs, fontWeight: '900' },
  pressed: { opacity: 0.74 },
});
