import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import CategoryCard from '../../components/CategoryCard';
import ProviderCard from '../../components/ProviderCard';
import SearchBar from '../../components/SearchBar';
import { Colors, FontSize, Radius, Shadows, Spacing } from '../../constants/theme';
import { CATEGORIES } from '../../lib/mockData';
import { Category, Provider } from '../../lib/types';
import { useMarketplace } from '../../providers/MarketplaceProvider';
import { useNotifications } from '../../providers/NotificationProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { getRatingForProvider, providers } = useMarketplace();
  const { unreadCount } = useNotifications();
  const [query, setQuery] = useState('');

  const topRated = useMemo(
    () =>
      [...providers]
        .sort((a, b) => {
          const aRating = getRatingForProvider(a.id);
          const bRating = getRatingForProvider(b.id);
          return bRating.average - aRating.average || bRating.count - aRating.count;
        })
        .slice(0, 3),
    [getRatingForProvider, providers]
  );

  const submitSearch = () => {
    const cleanQuery = query.trim();
    setQuery('');
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
          <BrandLogo width={166} />
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              onPress={() => router.push('/notifications')}
              testID="home-notifications-link"
              style={({ pressed }) => [styles.notificationButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={unreadCount ? 'notifications' : 'notifications-outline'}
                size={22}
                color={Colors.primary}
              />
              {unreadCount ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open service map for Beirut"
              onPress={() => router.push('/map')}
              testID="home-map-link"
              style={({ pressed }) => [styles.locationPill, pressed && styles.pressed]}
            >
              <Ionicons name="location" size={16} color={Colors.primary} />
              <Text numberOfLines={1} style={styles.locationText}>
                Beirut
              </Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.primaryDark} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.eyebrow}>
            <View style={styles.liveDot} />
            <Text style={styles.eyebrowText}>FAST LOCAL HELP</Text>
          </View>
          <Text style={styles.heroTitle}>What can we help with?</Text>
          <Text style={styles.heroText}>
            Describe the problem. We’ll match it to the right local service.
          </Text>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            onSubmit={submitSearch}
            placeholder={'Try “flat tire” or “leaking sink”'}
          />
          <View style={styles.searchNote}>
            <Ionicons name="sparkles-outline" size={15} color={Colors.primary} />
            <Text style={styles.searchNoteText}>Search by service, problem, or provider name</Text>
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
        style={({ pressed }) => [styles.sectionActionButton, pressed && styles.pressed]}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  notificationButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.primarySoft,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: Colors.danger,
  },
  notificationBadgeText: {
    color: Colors.textOnPrimary,
    fontSize: 9,
    fontWeight: '900',
  },
  locationPill: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  locationText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800' },
  hero: {
    marginHorizontal: Spacing.md,
    padding: Spacing.lg,
    gap: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.card,
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
    marginBottom: Spacing.xs,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 21,
  },
  searchNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  searchNoteText: { color: Colors.textMuted, fontSize: FontSize.xs },
  pressed: { opacity: 0.72 },
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
  sectionActionButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
  },
  sectionAction: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '800' },
  categoryRow: { gap: Spacing.sm + 2, paddingBottom: Spacing.sm },
});
