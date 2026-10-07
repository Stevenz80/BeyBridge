import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMarketplace } from '@/providers/MarketplaceProvider';

/** Keep stale results usable, but never mistake a failed request for an empty marketplace. */
export default function MarketplaceStatus() {
  const { providers, providersLoading, providersError, refreshProviders } = useMarketplace();
  if (!providersLoading && !providersError && providers.length > 0) {
    return providers.some((provider) => provider.mapSource) ? (
      <Pressable accessibilityRole="link" style={styles.retry}
        onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {})}>
        <Text style={styles.message}>Business data © OpenStreetMap contributors · ODbL</Text>
      </Pressable>
    ) : null;
  }
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      {providersLoading ? (
        <>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.message}>Loading services…</Text>
        </>
      ) : providersError ? (
        <>
          <Text style={styles.message}>{providersError}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refreshProviders()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </>
      ) : <Text style={styles.message}>No services are listed yet. Please check back soon.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.md },
  message: { flex: 1, color: Colors.textMuted, fontSize: 14, lineHeight: 21 },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  retryText: { color: Colors.primary, fontWeight: '700' },
});
