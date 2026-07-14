// app/search.tsx — the RESULTS screen
// Receives `query` and/or `categoryId` from the Home screen via params,
// filters the mock providers, and lets the user refine with filter chips.
//
// Later, this filtering logic becomes ONE Supabase query:
//   supabase.from('providers').select().eq('category_id', x).gte('avg_rating', 4)

import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '../components/SearchBar';
import ProviderCard from '../components/ProviderCard';
import { CATEGORIES, PROVIDERS, getCategory } from '../lib/mockData';
import { Provider } from '../lib/types';
import { Colors, Spacing, FontSize, Radius } from '../constants/theme';

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string; categoryId?: string }>();

  // Filter state — initialized from whatever Home passed us
  const [query, setQuery] = useState(params.query ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(
    params.categoryId ? Number(params.categoryId) : null
  );
  const [minRating, setMinRating] = useState<number | null>(null);

  // useMemo = "recompute this list only when its inputs change".
  // Not strictly needed at 12 items, but it's the right habit
  // and the exact shape our future Supabase query will replace.
  const results = useMemo(() => {
    return PROVIDERS.filter((p) => {
      if (categoryId !== null && p.categoryId !== categoryId) return false;
      if (minRating !== null && p.avgRating < minRating) return false;
      if (query.trim().length > 0) {
        const q = query.trim().toLowerCase();
        const haystack = `${p.name} ${p.description} ${p.area} ${
          getCategory(p.categoryId)?.name ?? ''
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [query, categoryId, minRating]);

  const openProvider = (provider: Provider) => {
    router.push(`/provider/${provider.id}`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <SearchBar value={query} onChangeText={setQuery} />

        {/* ── Filter chips: categories ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            label="All"
            active={categoryId === null}
            onPress={() => setCategoryId(null)}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              active={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
        </ScrollView>

        {/* ── Filter chips: minimum rating ── */}
        <View style={styles.chipRow}>
          {[4, 4.5].map((r) => (
            <Chip
              key={r}
              label={`★ ${r}+`}
              active={minRating === r}
              onPress={() => setMinRating(minRating === r ? null : r)}
            />
          ))}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ProviderCard provider={item} onPress={openProvider} />
        )}
        contentContainerStyle={styles.list}
        // Empty states should tell the user what to DO next
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyText}>
              Try a different word, or remove a filter to widen the search.
            </Text>
          </View>
        }
      />
    </View>
  );
}

// Small local component — used only on this screen, so it can live here.
function Chip({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  chipActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipLabel: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600' },
  chipLabelActive: { color: Colors.textOnDark },
  list: { padding: Spacing.md },
  empty: { alignItems: 'center', paddingTop: Spacing.xl * 2, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
