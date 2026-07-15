import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '../lib/types';
import { Colors, FontSize, Radius, Shadows, Spacing } from '../constants/theme';

type CategoryCardProps = {
  category: Category;
  onPress: (category: Category) => void;
};

export default function CategoryCard({ category, onPress }: CategoryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Find ${category.name}`}
      onPress={() => onPress(category)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={category.icon as never} size={24} color={Colors.primary} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {category.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 126,
    minHeight: 118,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  pressed: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.borderStrong,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
    lineHeight: 18,
  },
});
