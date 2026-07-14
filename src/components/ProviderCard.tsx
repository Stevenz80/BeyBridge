// components/ProviderCard.tsx
// The list card shown in Search Results (and later Favorites).
// Shows: name, category, area, rating. Tapping opens the details page.

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Provider } from '../lib/types';
import { getCategory } from '../lib/mockData';
import { Colors, Radius, Spacing, FontSize } from '../constants/theme';

interface Props {
  provider: Provider;
  onPress: (provider: Provider) => void;
}

export default function ProviderCard({ provider, onPress }: Props) {
  const category = getCategory(provider.categoryId);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(provider)}
    >
      {/* Icon bubble on the left */}
      <View style={styles.iconBubble}>
        <Ionicons
          name={(category?.icon ?? 'storefront-outline') as any}
          size={22}
          color={Colors.navy}
        />
      </View>

      {/* Main info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{provider.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {category?.name} · {provider.area}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={14} color={Colors.star} />
          <Text style={styles.rating}>{provider.avgRating.toFixed(1)}</Text>
          <Text style={styles.reviewCount}>({provider.reviewCount})</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  pressed: { backgroundColor: Colors.goldSoft },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  meta: { fontSize: FontSize.sm, color: Colors.textMuted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  reviewCount: { fontSize: FontSize.xs, color: Colors.textMuted },
});
