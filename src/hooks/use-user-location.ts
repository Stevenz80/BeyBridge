import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export type Coordinates = { latitude: number; longitude: number };

export function useUserLocation() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setError('Turn on location services to sort providers near you.');
        return null;
      }

      const currentPermission = await Location.getForegroundPermissionsAsync();
      const permission =
        currentPermission.status === 'granted'
          ? currentPermission
          : await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setError(
          permission.canAskAgain
            ? 'Location access was not granted. You can still search by area.'
            : 'Location access is disabled. Enable it in device settings to use Near me.'
        );
        return null;
      }

      const cached = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000,
        requiredAccuracy: 5000,
      });
      const location =
        cached ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const nextCoordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCoordinates(nextCoordinates);
      return nextCoordinates;
    } catch (locationError) {
      setError(
        locationError instanceof Error
          ? locationError.message
          : 'Your location could not be determined.'
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    coordinates,
    loading,
    error,
    requestLocation,
    clearLocation: () => {
      setCoordinates(null);
      setError(null);
    },
  };
}

export function getDistanceKm(origin: Coordinates, destination: Coordinates) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}
