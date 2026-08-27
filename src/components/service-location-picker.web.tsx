import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  formatCoordinates,
  reverseGeocodeCoordinates,
  useUserLocation,
  type Coordinates,
} from '@/hooks/use-user-location';
import type { ServiceLocationPickerProps } from './service-location-picker-types';

export default function ServiceLocationPicker({
  visible,
  initialCoordinates,
  initialAddress,
  onClose,
  onConfirm,
}: ServiceLocationPickerProps) {
  const [selection, setSelection] = useState<Coordinates | null>(initialCoordinates);
  const [address, setAddress] = useState(initialAddress);
  const { loading, error, requestLocation } = useUserLocation();

  const centerOnCurrentLocation = async () => {
    const coordinates = await requestLocation({ precise: true });
    if (!coordinates) return;
    setSelection(coordinates);
    try {
      setAddress(await reverseGeocodeCoordinates(coordinates));
    } catch {
      setAddress(formatCoordinates(coordinates));
    }
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Ionicons name="map-outline" size={30} color={Colors.primary} />
          <Text style={styles.title}>Choose service location</Text>
          <Text style={styles.body}>
            The interactive pin picker is available in the Android and iOS app. On web, you can
            attach your precise current location.
          </Text>
          {selection ? <Text style={styles.address}>{address || formatCoordinates(selection)}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void centerOnCurrentLocation()}
            style={styles.secondaryButton}
          >
            {loading ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.secondaryText}>Use current location</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!selection}
            onPress={() => selection && onConfirm({ coordinates: selection, address })}
            style={[styles.primaryButton, !selection && styles.disabled]}
          >
            <Text style={styles.primaryText}>Use this location</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(17, 17, 17, 0.42)',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  body: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  address: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800', textAlign: 'center' },
  error: { color: Colors.danger, fontSize: FontSize.xs, textAlign: 'center' },
  secondaryButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
  },
  secondaryText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  primaryButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  primaryText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  cancelButton: { minHeight: 44, justifyContent: 'center' },
  cancelText: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '800' },
  disabled: { opacity: 0.42 },
});
