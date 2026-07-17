import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ProviderCard from '../components/ProviderCard';
import SearchBar from '../components/SearchBar';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';
import { CATEGORIES, getCategory } from '../lib/mockData';
import { Provider } from '../lib/types';
import { useMarketplace } from '../providers/MarketplaceProvider';

export default function SearchScreen() {
  const router = useRouter();
  const { getRatingForProvider, providers } = useMarketplace();
  const params = useLocalSearchParams<{ query?: string; categoryId?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [categoryId, setCategoryId] = useState<number | null>(
    params.categoryId ? Number(params.categoryId) : null
  );
  const [minRating, setMinRating] = useState<number | null>(null);

  const results = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return providers.filter((provider) => {
      if (categoryId !== null && provider.categoryId !== categoryId) return false;
      if (minRating !== null && getRatingForProvider(provider.id).average < minRating) return false;
      if (!cleanQuery) return true;

      const searchable = [
        provider.name,
        provider.description,
        provider.area,
        provider.address,
        getCategory(provider.categoryId)?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(cleanQuery);
    });
  }, [categoryId, getRatingForProvider, minRating, providers, query]);

  const openProvider = (provider: Provider) => router.push(`/provider/${provider.id}`);

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search service or provider" />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="All services" active={categoryId === null} onPress={() => setCategoryId(null)} />
          {CATEGORIES.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onPress={() => setCategoryId(categoryId === category.id ? null : category.id)}
            />
          ))}
        </ScrollView>

        <View style={styles.filterFooter}>
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? 'service' : 'services'} found
          </Text>
          <View style={styles.ratingFilters}>
            {[4, 4.5].map((rating) => (
              <Chip
                key={rating}
                label={`★ ${rating}+`}
                active={minRating === rating}
                compact
                onPress={() => setMinRating(minRating === rating ? null : rating)}
              />
            ))}
          </View>
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(provider) => provider.id}
        renderItem={({ item }) => <ProviderCard provider={item} onPress={openProvider} />}
        contentContainerStyle={[styles.list, results.length === 0 && styles.emptyList]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="search-outline" size={30} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No services found</Text>
            <Text style={styles.emptyText}>
              Try another service name or clear one of your filters.
            </Text>
            <Pressable
              onPress={() => {
                setQuery('');
                setCategoryId(null);
                setMinRating(null);
              }}
              style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.clearButtonText}>Clear filters</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  compact = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        active && styles.chipActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  filters: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipRow: { gap: Spacing.sm, paddingRight: Spacing.md },
  chip: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },
  chipCompact: { minHeight: 36, paddingHorizontal: 12 },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  chipLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  chipLabelActive: { color: Colors.textOnPrimary },
  filterFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700' },
  ratingFilters: { flexDirection: 'row', gap: Spacing.sm },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  emptyList: { flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  emptyText: {
    maxWidth: 280,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  clearButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  clearButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '800' },
});
