import { useLocalSearchParams } from 'expo-router';

/**
 * Route params with repeated keys flattened. Expo Router turns
 * `?query=a&query=b` into an array, which crashed screens that expect one
 * string (for example by calling `.normalize()` during render).
 */
export function useRouteParams<T extends Record<string, string | undefined>>(): T {
  const params = useLocalSearchParams();
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  ) as T;
}
