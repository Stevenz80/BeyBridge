import { Linking, Platform } from 'react-native';

/** Open a route, rather than a place search, and recover if the native app is unavailable. */
export async function openDirectionsTo({
  latitude,
  longitude,
}: { latitude: number; longitude: number }) {
  const destination = `${latitude},${longitude}`;
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

  if (Platform.OS === 'ios') {
    try {
      await Linking.openURL(`maps://?daddr=${encodeURIComponent(destination)}`);
      return;
    } catch {
      // Apple Maps may have been removed. The HTTPS route works in a browser too.
    }
  }

  await Linking.openURL(webUrl);
}
