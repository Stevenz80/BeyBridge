import { Ionicons } from '@expo/vector-icons';
import {
  Camera,
  type CameraRef,
  Map,
  ViewAnnotation,
} from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Text from '@/components/localized-text';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import {
  formatCoordinates,
  reverseGeocodeCoordinates,
  useUserLocation,
  type Coordinates,
} from '@/hooks/use-user-location';
import type { ServiceLocationPickerProps } from './service-location-picker-types';

const OPEN_FREE_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const BEIRUT_CENTER: [longitude: number, latitude: number] = [35.5018, 33.8938];

export default function ServiceLocationPicker({
  visible,
  initialCoordinates,
  initialAddress,
  onClose,
  onConfirm,
}: ServiceLocationPickerProps) {
  const cameraRef = useRef<CameraRef>(null);
  const addressRequestId = useRef(0);
  const [selectedCoordinates, setSelectedCoordinates] = useState<Coordinates | null>(
    initialCoordinates
  );
  const [selectedAddress, setSelectedAddress] = useState(
    initialCoordinates ? initialAddress.trim() : ''
  );
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [mapAttempt, setMapAttempt] = useState(0);
  const { loading: locating, error: locationError, requestLocation } = useUserLocation();

  useEffect(() => {
    if (!visible || mapState !== 'loading') return;

    const timeout = setTimeout(() => setMapState('failed'), 12000);
    return () => clearTimeout(timeout);
  }, [mapAttempt, mapState, visible]);

  const selectCoordinates = useCallback(async (coordinates: Coordinates) => {
    const requestId = addressRequestId.current + 1;
    addressRequestId.current = requestId;
    setSelectedCoordinates(coordinates);
    setSelectedAddress(formatCoordinates(coordinates));
    setResolvingAddress(true);

    try {
      const address = await reverseGeocodeCoordinates(coordinates);
      if (addressRequestId.current === requestId) setSelectedAddress(address);
    } catch {
      // A pin remains valid even when the device geocoder is unavailable.
    } finally {
      if (addressRequestId.current === requestId) setResolvingAddress(false);
    }
  }, []);

  const centerOnCurrentLocation = async () => {
    const coordinates = await requestLocation({ precise: true });
    if (!coordinates) return;

    cameraRef.current?.easeTo({
      center: [coordinates.longitude, coordinates.latitude],
      zoom: 16,
      duration: 450,
    });
    await selectCoordinates(coordinates);
  };

  if (!visible) return null;

  const cameraCenter: [longitude: number, latitude: number] = initialCoordinates
    ? [initialCoordinates.longitude, initialCoordinates.latitude]
    : BEIRUT_CENTER;
  const canConfirm = selectedCoordinates !== null && !resolvingAddress;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Close location picker"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={25} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Choose service location</Text>
            <Text style={styles.subtitle}>Tap the map or drag the pin</Text>
          </View>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.mapContainer}>
          <Map
            key={mapAttempt}
            accessibilityLabel="Map for choosing the service location"
            androidView="texture"
            attribution
            attributionPosition={{ bottom: 8, left: 8 }}
            compass
            compassPosition={{ top: 74, right: 16 }}
            logo={false}
            mapStyle={OPEN_FREE_MAP_STYLE}
            onDidFailLoadingMap={() => setMapState('failed')}
            onDidFinishLoadingMap={() => setMapState('ready')}
            onPress={(event) => {
              const [longitude, latitude] = event.nativeEvent.lngLat;
              void selectCoordinates({ latitude, longitude });
            }}
            style={styles.map}
          >
            <Camera
              ref={cameraRef}
              initialViewState={{ center: cameraCenter, zoom: initialCoordinates ? 16 : 12 }}
              minZoom={8}
              maxZoom={19}
            />

            {selectedCoordinates ? (
              <ViewAnnotation
                anchor="bottom"
                draggable
                id="service-location-pin"
                lngLat={[selectedCoordinates.longitude, selectedCoordinates.latitude]}
                onDragEnd={(event) => {
                  const [longitude, latitude] = event.nativeEvent.lngLat;
                  void selectCoordinates({ latitude, longitude });
                }}
              >
                <View accessibilityLabel="Selected service location pin" style={styles.pin}>
                  <Ionicons name="location" size={34} color={Colors.primary} />
                </View>
              </ViewAnnotation>
            ) : null}
          </Map>

          <View pointerEvents="none" style={styles.instructionPill}>
            <Ionicons name="hand-left-outline" size={17} color={Colors.primaryDark} />
            <Text style={styles.instructionText}>
              {selectedCoordinates ? 'Drag the pin to fine-tune the spot' : 'Tap anywhere to place a pin'}
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Use my current location"
            accessibilityRole="button"
            accessibilityState={{ busy: locating }}
            disabled={locating}
            onPress={() => void centerOnCurrentLocation()}
            style={({ pressed }) => [
              styles.currentLocationButton,
              pressed && styles.pressed,
              locating && styles.disabled,
            ]}
          >
            {locating ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Ionicons name="navigate" size={23} color={Colors.primary} />
            )}
          </Pressable>

          {mapState === 'loading' ? (
            <View pointerEvents="none" style={styles.mapOverlay}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.overlayText}>Loading map...</Text>
            </View>
          ) : null}

          {mapState === 'failed' ? (
            <View style={styles.mapOverlay}>
              <Ionicons name="map-outline" size={28} color={Colors.primary} />
              <Text style={styles.overlayTitle}>The map could not load</Text>
              <Text style={styles.overlayText}>Check your connection, then try again.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMapAttempt((attempt) => attempt + 1);
                  setMapState('loading');
                }}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.confirmPanel}>
          <View style={styles.selectionRow}>
            <View style={styles.selectionIcon}>
              <Ionicons name="location" size={21} color={Colors.primary} />
            </View>
            <View style={styles.selectionCopy}>
              <Text style={styles.selectionLabel}>Selected location</Text>
              <Text numberOfLines={2} style={styles.selectionAddress}>
                {selectedCoordinates
                  ? resolvingAddress
                    ? 'Finding the address...'
                    : selectedAddress || formatCoordinates(selectedCoordinates)
                  : 'No pin placed yet'}
              </Text>
            </View>
          </View>

          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canConfirm }}
            disabled={!canConfirm}
            onPress={() => {
              if (!selectedCoordinates) return;
              onConfirm({
                coordinates: selectedCoordinates,
                address: selectedAddress || formatCoordinates(selectedCoordinates),
              });
            }}
            style={({ pressed }) => [
              styles.confirmButton,
              !canConfirm && styles.confirmButtonDisabled,
              pressed && canConfirm && styles.pressed,
            ]}
          >
            <Ionicons name="checkmark" size={21} color={Colors.textOnPrimary} />
            <Text style={styles.confirmText}>Use this location</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.surface },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center', gap: 2 },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.xs },
  mapContainer: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  instructionPill: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  instructionText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800' },
  currentLocationButton: {
    position: 'absolute',
    right: Spacing.md,
    bottom: Spacing.md,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  pin: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.surface,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  overlayTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  overlayText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  retryText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  confirmPanel: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  selectionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  selectionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  selectionCopy: { flex: 1, gap: 2 },
  selectionLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700' },
  selectionAddress: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800', lineHeight: 19 },
  errorText: { color: Colors.danger, fontSize: FontSize.xs, lineHeight: 18 },
  confirmButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  confirmButtonDisabled: { opacity: 0.42 },
  confirmText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
