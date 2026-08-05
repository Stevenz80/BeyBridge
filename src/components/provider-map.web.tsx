import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { getCategory } from '@/lib/mockData';
import type { Provider } from '@/lib/types';

type ProviderMapProps = {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
};

export default function ProviderMap({
  providers,
  selectedProviderId,
  onSelectProvider,
}: ProviderMapProps) {
  return (
    <ScrollView
      accessibilityLabel="Service provider locations"
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
      testID="provider-map"
    >
      <View style={styles.webNotice}>
        <Ionicons name="map-outline" size={22} color={Colors.primary} />
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>Provider map</Text>
          <Text style={styles.noticeText}>
            The interactive map is available in the iOS and Android app. Select a location here to
            see its details or open it in your map app.
          </Text>
        </View>
      </View>

      {providers.map((provider) => {
        const selected = provider.id === selectedProviderId;
        const category = getCategory(provider.categoryId);

        return (
          <Pressable
            key={provider.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${provider.name} in ${provider.area}`}
            accessibilityState={{ selected }}
            onPress={() => onSelectProvider(provider.id)}
            style={({ pressed }) => [
              styles.locationCard,
              selected && styles.locationCardSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.pin, selected && styles.pinSelected]}>
              <Ionicons
                name="location"
                size={18}
                color={selected ? Colors.textOnPrimary : Colors.primary}
              />
            </View>
            <View style={styles.locationCopy}>
              <Text style={styles.providerName}>{provider.name}</Text>
              <Text style={styles.providerMeta}>
                {category?.name ?? 'Local service'} · {provider.area}
              </Text>
              <Text style={styles.providerAddress}>{provider.address}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSubtle} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: 230,
  },
  webNotice: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  noticeCopy: { flex: 1, gap: Spacing.xs },
  noticeTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  noticeText: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  locationCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  locationCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  pin: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: Colors.primarySoft,
  },
  pinSelected: { backgroundColor: Colors.primary },
  locationCopy: { flex: 1, gap: 2 },
  providerName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  providerMeta: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '700' },
  providerAddress: { color: Colors.textMuted, fontSize: FontSize.xs },
  pressed: { opacity: 0.74 },
});
