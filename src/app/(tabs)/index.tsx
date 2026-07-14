// app/(tabs)/index.tsx — the HOME screen
// Layout: navy hero (slogan + search) → category grid → top-rated list.
//
// Navigation pattern used everywhere in this app:
//   router.push({ pathname: '/search', params: { query: 'nails' } })
// pushes the Results screen and passes data through URL-style params.

import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import SearchBar from '../../components/SearchBar';
import CategoryCard from '../../components/CategoryCard';
import ProviderCard from '../../components/ProviderCard';
import { CATEGORIES, PROVIDERS } from '../../lib/mockData';
import { Category, Provider } from '../../lib/types';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  // Top 3 providers by rating, shown as a teaser section
  const topRated = [...PROVIDERS]
    .sort((a, b) => b.avgRating - a.avgRating)
    .slice(0, 3);

  const submitSearch = () => {
    if (query.trim().length === 0) return;
    router.push({ pathname: '/search', params: { query: query.trim() } });
  };

  const openCategory = (category: Category) => {
    router.push({ pathname: '/search', params: { categoryId: String(category.id) } });
  };

  const openProvider = (provider: Provider) => {
    router.push(`/provider/${provider.id}`);
  };

  return (
    <ScrollView style={styles.screen} keyboardShouldPersistTaps="handled">
      {/* ── Hero ─────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Ahla w sahla 👋</Text>
        <Text style={styles.heroSlogan}>
          Your link to the heart of Beirut's services
        </Text>
        <SearchBar value={query} onChangeText={setQuery} onSubmit={submitSearch} />
      </View>

      {/* ── Categories ───────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Browse by category</Text>
        {/* numColumns={4} → a 2-row, 4-column grid for our 8 categories.
            scrollEnabled={false} because the outer ScrollView scrolls. */}
        <FlatList
          data={CATEGORIES}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item }) => (
            <CategoryCard category={item} onPress={openCategory} />
          )}
          numColumns={4}
          scrollEnabled={false}
        />
      </View>

      {/* ── Top rated ────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top rated near you</Text>
        {topRated.map((p) => (
          <ProviderCard key={p.id} provider={p} onPress={openProvider} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  hero: {
    backgroundColor: Colors.navy,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.lg,
    borderBottomRightRadius: Radius.lg,
    gap: Spacing.sm,
  },
  heroTitle: {
    color: Colors.textOnDark,
    fontSize: FontSize.xl,
    fontWeight: '800',
  },
  heroSlogan: {
    color: Colors.goldSoft,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  section: { padding: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
});
