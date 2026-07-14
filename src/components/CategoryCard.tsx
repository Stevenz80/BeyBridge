// components/CategoryCard.tsx
// One tile in the Home screen's category grid.

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../lib/types';
import { Colors, Radius, Spacing, FontSize } from '../constants/theme';

interface Props {
  category: Category;
  onPress: (category: Category) => void;
}

export default function CategoryCard({ category, onPress }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(category)}
    >
      {/* `as any` because Ionicons names are a huge string union type */}
      <Ionicons name={category.icon as any} size={26} color={Colors.navy} />
      <Text style={styles.label}>{category.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    margin: Spacing.xs,
    minHeight: 88,
  },
  pressed: {
    backgroundColor: Colors.goldSoft,
    borderColor: Colors.gold,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
});
