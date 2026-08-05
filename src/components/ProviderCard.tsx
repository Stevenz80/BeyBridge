import React from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Provider } from '../lib/types';
import { getCategory } from '../lib/mockData';
import { Colors, FontSize, Radius, Shadows, Spacing } from '../constants/theme';
import { useAuth } from '../providers/AuthProvider';
import { useMarketplace } from '../providers/MarketplaceProvider';

type ProviderCardProps = {
  provider: Provider;
  onPress: (provider: Provider) => void;
  distanceKm?: number | null;
};

export default function ProviderCard({ provider, onPress, distanceKm }: ProviderCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { favoriteIds, getRatingForProvider, toggleFavorite } = useMarketplace();
  const [saving, setSaving] = React.useState(false);
  const category = getCategory(provider.categoryId);
  const isSaved = favoriteIds.has(provider.id);
  const isOwner = provider.ownerId === user?.id;
  const rating = getRatingForProvider(provider.id);
  const call = () => void Linking.openURL(`tel:${provider.phone}`);
  const whatsapp = () => void Linking.openURL(`https://wa.me/${provider.whatsapp}`);

  const save = async () => {
    if (!user) {
      Alert.alert(
        'Sign in to save',
        'Create an account or sign in to keep trusted services in your Saved tab.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/profile') },
        ]
      );
      return;
    }

    setSaving(true);
    const result = await toggleFavorite(provider.id);
    setSaving(false);
    if (result.error) Alert.alert('Could not update Saved', result.error);
  };

  return (
    <View style={styles.card}>
      {!isOwner && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isSaved ? `Remove ${provider.name} from Saved` : `Save ${provider.name}`}
          accessibilityState={{ selected: isSaved, busy: saving }}
          hitSlop={8}
          disabled={saving}
          onPress={save}
          style={({ pressed }) => [styles.favoriteButton, pressed && styles.favoritePressed]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons
              name={isSaved ? 'heart' : 'heart-outline'}
              size={22}
              color={isSaved ? Colors.danger : Colors.primary}
            />
          )}
        </Pressable>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${provider.name}`}
        onPress={() => onPress(provider)}
        style={({ pressed }) => [styles.details, pressed && styles.detailsPressed]}
      >
        <View style={styles.topRow}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={(category?.icon ?? 'construct-outline') as never}
              size={23}
              color={Colors.primary}
            />
          </View>
          <View style={styles.titleBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>{provider.name}</Text>
              {provider.isVerified && (
                <Ionicons name="checkmark-circle" size={17} color={Colors.success} />
              )}
            </View>
            <Text style={styles.category}>{category?.name ?? 'Local service'}</Text>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>
          {provider.description || 'Service details coming soon.'}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color={Colors.primaryDark} />
            <Text style={styles.metaText} numberOfLines={1}>
              {provider.area}
              {distanceKm != null ? ` · ${formatDistance(distanceKm)}` : ''}
            </Text>
          </View>
          <View style={styles.rating}>
            <Ionicons name="star" size={15} color={Colors.star} />
            {rating.count ? (
              <>
                <Text style={styles.ratingValue}>{rating.average.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({rating.count})</Text>
              </>
            ) : (
              <Text style={styles.reviewCount}>New</Text>
            )}
          </View>
        </View>
        {(provider.emergencyService || provider.priceType) && (
          <View style={styles.signalRow}>
            {provider.emergencyService && (
              <View style={styles.signalBadge}>
                <Ionicons name="flash" size={13} color={Colors.primaryDark} />
                <Text style={styles.signalText}>Urgent requests</Text>
              </View>
            )}
            {provider.priceType && (
              <View style={styles.signalBadge}>
                <Ionicons name="pricetag-outline" size={13} color={Colors.primaryDark} />
                <Text style={styles.signalText}>{formatPrice(provider)}</Text>
              </View>
            )}
          </View>
        )}
      </Pressable>

      {(provider.phone || provider.whatsapp) && (
        <View style={styles.actions}>
          {provider.phone ? <ContactButton icon="call-outline" label="Call" onPress={call} /> : null}
          {provider.whatsapp ? (
            <ContactButton icon="logo-whatsapp" label="WhatsApp" onPress={whatsapp} primary />
          ) : null}
        </View>
      )}
    </View>
  );
}

function formatPrice(provider: Provider) {
  if (provider.priceType === 'quote' || provider.startingPrice == null) return 'Quote';
  const amount = new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(
    provider.startingPrice
  );
  return `${amount} ${provider.priceCurrency ?? 'USD'}${provider.priceType === 'hourly' ? '/hr' : '+'}`;
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.max(100, Math.round((distanceKm * 1000) / 100) * 100)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

function ContactButton({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} provider`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        pressed && styles.actionPressed,
      ]}
    >
      <Ionicons
        name={icon as never}
        size={18}
        color={primary ? Colors.textOnPrimary : Colors.primary}
      />
      <Text style={[styles.actionLabel, primary && styles.actionLabelPrimary]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.card,
    overflow: 'hidden',
    ...Shadows.card,
  },
  details: {
    padding: Spacing.md,
    paddingRight: 62,
    gap: Spacing.sm + 2,
  },
  detailsPressed: { backgroundColor: Colors.primarySoft },
  favoriteButton: {
    position: 'absolute',
    zIndex: 2,
    top: 12,
    right: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 21,
    backgroundColor: Colors.surface,
  },
  favoritePressed: { transform: [{ scale: 0.94 }], opacity: 0.8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  titleBlock: { flex: 1, gap: Spacing.xxs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name: { flex: 1, color: Colors.text, fontSize: FontSize.md, fontWeight: '800' },
  category: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '700' },
  description: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  reviewCount: { color: Colors.textMuted, fontSize: FontSize.xs },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  signalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  signalText: { color: Colors.primaryDark, fontSize: 10, fontWeight: '800' },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  actionButton: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  actionButtonPrimary: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  actionPressed: { opacity: 0.78 },
  actionLabel: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '800' },
  actionLabelPrimary: { color: Colors.textOnPrimary },
});
