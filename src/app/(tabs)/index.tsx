import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import CategoryCard from '../../components/CategoryCard';
import ProviderCard from '../../components/ProviderCard';
import SearchBar from '../../components/SearchBar';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { CATEGORIES } from '../../lib/mockData';
import { Category, Provider } from '../../lib/types';
import { useMarketplace } from '../../providers/MarketplaceProvider';

const QUICK_SEARCHES = [
  { label: 'Plumber', categoryId: 1, icon: 'water-outline' },
  { label: 'Towing', categoryId: 6, icon: 'car-outline' },
  { label: 'Locksmith', categoryId: 13, icon: 'key-outline' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { getRatingForProvider, providers } = useMarketplace();
  const [query, setQuery] = useState('');

  const topRated = useMemo(
    () =>
      [...providers]
        .sort((a, b) => {
          const aRating = getRatingForProvider(a.id);
          const bRating = getRatingForProvider(b.id);
          return bRating.average - aRating.average || bRating.count - aRating.count;
        })
        .slice(0, 4),
    [getRatingForProvider, providers]
  );

  const submitSearch = () => {
    const cleanQuery = query.trim();
    router.push({ pathname: '/search', params: cleanQuery ? { query: cleanQuery } : {} });
  };

  const openCategory = (category: Category) => {
    router.push({ pathname: '/search', params: { categoryId: String(category.id) } });
  };

  const openProvider = (provider: Provider) => router.push(`/provider/${provider.id}`);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandHeader}>
          <BrandLogo width={210} />
          <View style={styles.locationPill}>
            <Ionicons name="location" size={14} color={Colors.primary} />
            <Text style={styles.locationText}>Beirut</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.eyebrow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrowText}>FAST LOCAL HELP</Text>
          </View>
          <Text style={styles.heroTitle}>Help, right when you need it.</Text>
          <Text style={styles.heroText}>
            Find trusted local services, compare options, and contact someone in a few taps.
          </Text>
          <SearchBar value={query} onChangeText={setQuery} onSubmit={submitSearch} />

          <View style={styles.quickSearchRow}>
            {QUICK_SEARCHES.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={`Search for ${item.label}`}
                onPress={() =>
                  router.push({
                    pathname: '/search',
                    params: { categoryId: String(item.categoryId) },
                  })
                }
                style={({ pressed }) => [styles.quickSearch, pressed && styles.quickSearchPressed]}
              >
                <Ionicons name={item.icon as never} size={16} color={Colors.primaryDark} />
                <Text style={styles.quickSearchText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Quick help"
            subtitle="Choose what you need"
            action="All services"
            onAction={() => router.push('/search')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORIES.slice(0, 10).map((category) => (
              <CategoryCard key={category.id} category={category} onPress={openCategory} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Top rated in Beirut"
            subtitle="Popular local professionals"
            action="See all"
            onAction={() => router.push('/search')}
          />
          {topRated.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} onPress={openProvider} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        onPress={onAction}
        hitSlop={8}
      >
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xl },
  brandHeader: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  locationText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800' },
  hero: {
    marginHorizontal: Spacing.md,
    padding: Spacing.lg,
    gap: Spacing.sm + 2,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySoft,
  },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  eyebrowText: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroTitle: {
    maxWidth: 310,
    color: Colors.text,
    fontSize: FontSize.hero,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 35,
  },
  heroText: {
    marginBottom: Spacing.sm,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 21,
  },
  quickSearchRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  quickSearch: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  quickSearchPressed: { opacity: 0.72 },
  quickSearchText: { color: Colors.primaryDark, fontSize: 11, fontWeight: '800' },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionHeading: { gap: 2 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs },
  sectionAction: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '800' },
  categoryRow: { gap: Spacing.sm + 2, paddingBottom: Spacing.sm },
});
