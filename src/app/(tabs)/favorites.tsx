// app/(tabs)/favorites.tsx
// Placeholder for now. Favorites need a logged-in user, so this
// screen gets real in the Supabase + Auth step. Even placeholders
// deserve a proper empty state that points the user somewhere useful.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../../constants/theme';

export default function FavoritesScreen() {
  return (
    <View style={styles.screen}>
      <Ionicons name="heart-outline" size={44} color={Colors.textMuted} />
      <Text style={styles.title}>Nothing saved yet</Text>
      <Text style={styles.text}>
        Tap the heart on any place to keep it here. Saving arrives with
        accounts in the next build step.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  text: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
