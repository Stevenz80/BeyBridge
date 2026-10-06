import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  type CameraRef,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';

import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/mockData';
import ProviderMapFallback, {
  type MapViewportPadding,
  type ProviderMapProps,
} from './provider-map-fallback';

const OPEN_FREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const BEIRUT_CENTER: [longitude: number, latitude: number] = [35.5018, 33.8938];
const DEFAULT_VIEWPORT_PADDING: MapViewportPadding = {
  top: 140,
  right: 32,
  bottom: 220,
  left: 32,
};

export default function MapLibreProviderMap({
  providers,
  selectedProviderId,
  onSelectProvider,
  userLocation,
  fitRequestId = 0,
  centerOnUserRequestId = 0,
  selectedCategoryId = null,
  ratingByProvider = {},
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  onMapInteraction,
  onMapPress,
  onViewportChange,
}: ProviderMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const lastHandledFitRequest = useRef<number | null>(null);
  const viewportPaddingRef = useRef(viewportPadding);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId]
  );

  useEffect(() => {
    viewportPaddingRef.current = viewportPadding;
  }, [viewportPadding]);

  useEffect(() => {
    if (mapState !== 'loading') return;

    const timeout = setTimeout(() => setMapState('failed'), 12000);
    return () => clearTimeout(timeout);
  }, [mapAttempt, mapState]);

  useEffect(() => {
    if (
      mapState !== 'ready' ||
      selectedProvider?.latitude == null ||
      selectedProvider.longitude == null
    ) {
      return;
    }

    cameraRef.current?.easeTo({
      center: [selectedProvider.longitude, selectedProvider.latitude],
      padding: viewportPaddingRef.current,
      zoom: 14,
      duration: 350,
    });
  }, [mapState, selectedProvider]);

  useEffect(() => {
    if (
      mapState !== 'ready' ||
      lastHandledFitRequest.current === fitRequestId
    ) {
      return;
    }

    if (selectedProviderId) {
      lastHandledFitRequest.current = fitRequestId;
      return;
    }

    const locations = providers.flatMap((provider) =>
      provider.latitude == null || provider.longitude == null
        ? []
        : [[provider.longitude, provider.latitude] as [number, number]]
    );

    if (locations.length === 0) return;
    lastHandledFitRequest.current = fitRequestId;
    if (locations.length === 1) {
      cameraRef.current?.easeTo({
        center: locations[0],
        padding: viewportPaddingRef.current,
        zoom: 14,
        duration: 400,
      });
      return;
    }

    const longitudes = locations.map(([longitude]) => longitude);
    const latitudes = locations.map(([, latitude]) => latitude);
    cameraRef.current?.fitBounds(
      [
        Math.min(...longitudes),
        Math.min(...latitudes),
        Math.max(...longitudes),
        Math.max(...latitudes),
      ],
      {
        padding: viewportPaddingRef.current,
        duration: 450,
      }
    );
  }, [fitRequestId, mapState, providers, selectedProviderId]);

  useEffect(() => {
    if (mapState !== 'ready' || !userLocation || centerOnUserRequestId === 0) return;

    cameraRef.current?.easeTo({
      center: [userLocation.longitude, userLocation.latitude],
      padding: viewportPaddingRef.current,
      zoom: 14,
      duration: 450,
    });
  }, [centerOnUserRequestId, mapState, userLocation]);

  if (mapState === 'failed') {
    return (
      <ProviderMapFallback
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelectProvider={onSelectProvider}
        selectedCategoryId={selectedCategoryId}
        ratingByProvider={ratingByProvider}
        description="The map tiles did not load. Browse the available locations below or try the map again."
        actionLabel="Try map again"
        onAction={() => {
          lastHandledFitRequest.current = null;
          setMapAttempt((attempt) => attempt + 1);
          setMapState('loading');
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Map
        key={mapAttempt}
        accessibilityLabel="Map of service providers in Beirut"
        androidView="texture"
        attribution
        attributionPosition={{ bottom: Math.max(8, viewportPadding.bottom - 24), left: 8 }}
        compass
        compassPosition={{ top: viewportPadding.top + 8, right: 16 }}
        contentInset={viewportPadding}
        logo={false}
        mapStyle={OPEN_FREE_MAP_STYLE}
        style={styles.map}
        testID="provider-map"
        tintColor={Colors.primary}
        onPress={onMapPress}
        onRegionWillChange={({ nativeEvent }) => {
          if (nativeEvent.userInteraction) onMapInteraction?.();
        }}
        onRegionDidChange={({ nativeEvent }) => {
          if (!nativeEvent.userInteraction) return;
          onViewportChange?.({
            bounds: nativeEvent.bounds,
            center: nativeEvent.center,
            zoom: nativeEvent.zoom,
          });
        }}
        onDidFailLoadingMap={() => setMapState('failed')}
        onDidFinishLoadingMap={() => setMapState('ready')}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: BEIRUT_CENTER, zoom: 11.5 }}
          minZoom={8}
          maxZoom={18}
        />

        {userLocation ? (
          <Marker
            accessibilityLabel="Your current location"
            anchor="center"
            id="beybridge-user-location"
            lngLat={[userLocation.longitude, userLocation.latitude]}
          >
            <View accessibilityLabel="Your current location" style={styles.userLocationMarker}>
              <View style={styles.userLocationCore} />
            </View>
          </Marker>
        ) : null}

        {providers.map((provider) => {
          if (provider.latitude == null || provider.longitude == null) return null;

          const selected = provider.id === selectedProviderId;
          const category = getCategory(provider.categoryId);
          const rating = ratingByProvider[provider.id];
          const showRating = selectedCategoryId === provider.categoryId;
          return (
            <Marker
              key={provider.id}
              accessibilityLabel={`${provider.name} in ${provider.area}`}
              anchor="bottom"
              id={provider.id}
              lngLat={[provider.longitude, provider.latitude]}
              onPress={(event) => {
                event.stopPropagation();
                onSelectProvider(provider.id);
              }}
            >
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Select ${provider.name} in ${provider.area}${showRating && rating?.count ? `, rated ${rating.average.toFixed(1)}` : ''}`}
                style={styles.markerContainer}
              >
                <View style={[styles.marker, selected && styles.markerSelected]}>
                  <Ionicons
                    name={
                      (category?.icon ?? 'location-outline') as ComponentProps<
                        typeof Ionicons
                      >['name']
                    }
                    size={selected ? 23 : 20}
                    color={selected ? Colors.textOnPrimary : Colors.primary}
                  />
                </View>
                {showRating ? (
                  <View style={[styles.markerRating, selected && styles.markerRatingSelected]}>
                    <Text style={styles.markerRatingText}>
                      {rating?.count ? rating.average.toFixed(1) : 'New'}
                    </Text>
                    {rating?.count ? <Ionicons name="star" size={11} color={Colors.star} /> : null}
                  </View>
                ) : null}
              </View>
            </Marker>
          );
        })}
      </Map>

      {mapState === 'loading' ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading service map...</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  markerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    margin: -5,
  },
  marker: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  markerSelected: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
  },
  markerRating: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: -3,
    paddingLeft: 8,
    paddingRight: 7,
    borderWidth: 2,
    borderColor: Colors.surface,
    borderTopRightRadius: Radius.full,
    borderBottomRightRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  markerRatingSelected: { borderColor: Colors.primarySoft },
  markerRatingText: { color: Colors.text, fontSize: 11, fontWeight: '900' },
  userLocationMarker: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: 12,
    backgroundColor: 'rgba(126, 91, 239, 0.22)',
  },
  userLocationCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700' },
});
