// app/provider/[id].tsx — the DETAILS screen
// The [id] in the filename makes this a DYNAMIC route:
// navigating to /provider/p3 renders this screen with id = "p3".
//
// Design choice: instead of embedding a map (which needs API keys and
// native config), the "Directions" button opens Google Maps with the
// provider's coordinates via Linking. Simpler, works in Expo Go,
// and honestly what users do anyway. We can embed a real map later.

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Linking,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProvider, getCategory, getReviewsFor } from '../../lib/mockData';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export default function ProviderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = getProvider(id);

  // Always handle the "not found" case — later this also covers
  // slow network / deleted rows when data comes from Supabase.
  if (!provider) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>This place is no longer listed.</Text>
      </View>
    );
  }

  const category = getCategory(provider.categoryId);
  const reviews = getReviewsFor(provider.id);

  // ── Contact actions via deep links ──
  const call = () => Linking.openURL(`tel:${provider.phone}`);
  const whatsapp = () => Linking.openURL(`https://wa.me/${provider.whatsapp}`);
  const directions = () =>
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${provider.latitude},${provider.longitude}`
    );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
      {/* Put the provider name in the navigation header */}
      <Stack.Screen options={{ title: provider.name }} />

      {/* ── Header block ── */}
      <View style={styles.headerBlock}>
        <Text style={styles.name}>{provider.name}</Text>
        <Text style={styles.meta}>
          {category?.name} · {provider.area}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color={Colors.star} />
          <Text style={styles.rating}>{provider.avgRating.toFixed(1)}</Text>
          <Text style={styles.reviewCount}>· {provider.reviewCount} reviews</Text>
        </View>
      </View>

      {/* ── Action buttons ── */}
      <View style={styles.actions}>
        <ActionButton icon="call" label="Call" onPress={call} primary />
        <ActionButton icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} primary />
        <ActionButton icon="navigate" label="Directions" onPress={directions} />
      </View>

      {/* ── About ── */}
      <Section title="About">
        <Text style={styles.bodyText}>{provider.description}</Text>
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={18} color={Colors.teal} />
          <Text style={styles.bodyText}>{provider.address}</Text>
        </View>
      </Section>

      {/* ── Opening hours ── */}
      <Section title="Opening hours">
        {Object.entries(provider.openingHours).map(([day, hours]) => (
          <View key={day} style={styles.hoursRow}>
            <Text style={styles.hoursDay}>{DAY_LABELS[day] ?? day}</Text>
            <Text
              style={[
                styles.hoursValue,
                hours === 'Closed' && { color: Colors.danger },
              ]}
            >
              {hours}
            </Text>
          </View>
        ))}
      </Section>

      {/* ── Reviews ── */}
      <Section title={`Reviews (${reviews.length})`}>
        {reviews.length === 0 ? (
          <Text style={styles.bodyText}>
            No reviews yet — be the first once reviews go live!
          </Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewName}>{r.userName}</Text>
                <View style={styles.reviewStars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < r.rating ? 'star' : 'star-outline'}
                      size={13}
                      color={Colors.star}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.bodyText}>{r.comment}</Text>
              <Text style={styles.reviewDate}>{r.createdAt}</Text>
            </View>
          ))
        )}
      </Section>
    </ScrollView>
  );
}

// ── Small local building blocks ───────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionButton({
  icon, label, onPress, primary = false,
}: { icon: string; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary && styles.actionPrimary,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={primary ? Colors.textOnDark : Colors.navy}
      />
      <Text style={[styles.actionLabel, primary && { color: Colors.textOnDark }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  headerBlock: {
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  name: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  meta: { fontSize: FontSize.md, color: Colors.textMuted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  reviewCount: { fontSize: FontSize.sm, color: Colors.textMuted },

  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm + 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  actionPrimary: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  actionLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.navy },

  section: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  bodyText: { fontSize: FontSize.sm, color: Colors.text, lineHeight: 20, flexShrink: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hoursDay: { fontSize: FontSize.sm, color: Colors.textMuted },
  hoursValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },

  reviewCard: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    gap: 4,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  reviewName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  reviewStars: { flexDirection: 'row', gap: 1 },
  reviewDate: { fontSize: FontSize.xs, color: Colors.textMuted },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: FontSize.md, color: Colors.textMuted },
});
