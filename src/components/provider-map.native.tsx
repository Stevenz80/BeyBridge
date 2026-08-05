import { useEffect, useMemo, useRef } from 'react';
import MapView, { Marker, type Region } from 'react-native-maps';

import { Colors } from '@/constants/theme';
import type { Provider } from '@/lib/types';

type ProviderMapProps = {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
};

const BEIRUT_REGION: Region = {
  latitude: 33.8938,
  longitude: 35.5018,
  latitudeDelta: 0.09,
  longitudeDelta: 0.13,
};

export default function ProviderMap({
  providers,
  selectedProviderId,
  onSelectProvider,
}: ProviderMapProps) {
  const mapRef = useRef<MapView>(null);
  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId]
  );

  useEffect(() => {
    if (selectedProvider?.latitude == null || selectedProvider.longitude == null) return;

    mapRef.current?.animateToRegion(
      {
        latitude: selectedProvider.latitude,
        longitude: selectedProvider.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      },
      300
    );
  }, [selectedProvider]);

  return (
    <MapView
      ref={mapRef}
      accessibilityLabel="Map of service providers in Beirut"
      initialRegion={BEIRUT_REGION}
      mapPadding={{ top: 72, right: 16, bottom: 210, left: 16 }}
      showsCompass
      showsPointsOfInterests
      style={{ flex: 1 }}
      testID="provider-map"
    >
      {providers.map((provider) => (
        <Marker
          key={provider.id}
          accessibilityLabel={`${provider.name} in ${provider.area}`}
          coordinate={{
            latitude: provider.latitude!,
            longitude: provider.longitude!,
          }}
          description={provider.address}
          pinColor={provider.id === selectedProviderId ? Colors.danger : Colors.primary}
          title={provider.name}
          onPress={() => onSelectProvider(provider.id)}
        />
      ))}
    </MapView>
  );
}
