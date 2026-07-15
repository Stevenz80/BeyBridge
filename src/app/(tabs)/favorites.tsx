import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ProviderCard from '../../components/ProviderCard';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';
import { PROVIDERS } from '../../lib/mockData';
import { useAuth } from '../../providers/AuthProvider';
import { useMarketplace } from '../../providers/MarketplaceProvider';

export default function FavoritesScreen() {
  const router = useRouter();
  const { configured, loading, user } = useAuth();
  const { favoriteIds, favoritesLoading } = useMarketplace();

  if (loading || (user && favoritesLoading)) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your saved services…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <EmptyState
        icon="person-outline"
        title="Sign in to save services"
        description={
          configured
            ? 'Create an account or sign in, then keep trusted providers ready for the next time you need help.'
            : 'Connect Supabase from the Profile tab to enable accounts and saved services.'
        }
        actionLabel={configured ? 'Go to account' : 'View setup'}
        onAction={() => router.push('/profile')}
      />
    );
  }

  const savedProviders = PROVIDERS.filter((provider) => favoriteIds.has(provider.id));

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      data={savedProviders}
      keyExtractor={(provider) => provider.id}
      renderItem={({ item }) => (
        <ProviderCard
          provider={item}
          onPress={(provider) => router.push(`/provider/${provider.id}`)}
        />
      )}
      contentContainerStyle={[
        styles.list,
        savedProviders.length === 0 && styles.emptyList,
      ]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        savedProviders.length ? (
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Your trusted services</Text>
            <Text style={styles.listSubtitle}>
              {savedProviders.length} {savedProviders.length === 1 ? 'service' : 'services'} saved
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          icon="heart-outline"
          title="Nothing saved yet"
          description="Tap the heart on a service to keep it here for quick access later."
          actionLabel="Browse services"
          onAction={() => router.push('/search')}
        />
      }
    />
  );
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <View style={styles.centeredScreen}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon as never} size={34} color={Colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{description}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>{actionLabel}</Text>
        <Ionicons name="arrow-forward" size={18} color={Colors.textOnPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centeredScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  list: { padding: Spacing.md, paddingBottom: Spacing.xl, backgroundColor: Colors.background },
  emptyList: { flexGrow: 1, padding: 0 },
  listHeader: { gap: 3, paddingBottom: Spacing.md },
  listTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  listSubtitle: { color: Colors.textMuted, fontSize: FontSize.sm },
  iconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  text: {
    maxWidth: 320,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  buttonPressed: { backgroundColor: Colors.primaryPressed },
  buttonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
});
