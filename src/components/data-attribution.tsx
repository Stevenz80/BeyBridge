import { Linking, Pressable, StyleSheet } from 'react-native';
import Text from '@/components/localized-text';
import { Colors, FontSize, Spacing } from '@/constants/theme';
import type { Provider } from '@/lib/types';

/**
 * ODbL requires visible attribution wherever OpenStreetMap-derived listings are
 * shown. A quiet footer at the end of a list satisfies that without competing
 * with the content; it only appears when a shown listing comes from OSM.
 */
export default function DataAttribution({ providers }: { providers: readonly Provider[] }) {
  if (!providers.some((provider) => provider.mapSource)) return null;
  return (
    <Pressable accessibilityRole="link" style={styles.link}
      onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {})}>
      <Text style={styles.text}>Business data © OpenStreetMap contributors · ODbL</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  text: { color: Colors.textSubtle, fontSize: FontSize.xs, textAlign: 'center' },
});
