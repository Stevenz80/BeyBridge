import { Pressable, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMarketplace } from '@/providers/MarketplaceProvider';

export default function AccountStatus() {
  const { accountError, refreshAccountData } = useMarketplace();
  if (!accountError) return null;
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Text style={styles.message}>{accountError}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void refreshAccountData()}
        style={({ pressed }) => [styles.retry, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm,
    padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.dangerSoft },
  message: { flex: 1, color: Colors.danger, fontSize: 14, lineHeight: 21 },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.md,
    borderRadius: Radius.md, backgroundColor: Colors.surface },
  retryText: { color: Colors.primary, fontWeight: '700' },
});
