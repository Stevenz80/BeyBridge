// app/(tabs)/profile.tsx
// Placeholder until we wire up Supabase Auth (sign up / login / logout).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../../constants/theme';

export default function ProfileScreen() {
  return (
    <View style={styles.screen}>
      <Ionicons name="person-circle-outline" size={44} color={Colors.textMuted} />
      <Text style={styles.title}>Accounts coming soon</Text>
      <Text style={styles.text}>
        Sign up, login, and your submitted places will live here once we
        connect Supabase Auth.
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
