import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import AccountStatus from '@/components/account-status';
import LegalLinks from '@/components/legal-links';
import LanguageToggle from '@/components/language-toggle';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import ProfileEditor from '../../components/profile-editor';
import { Colors, FontSize, Radius, Shadows, Spacing } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useMarketplace } from '../../providers/MarketplaceProvider';
import { useLocalization } from '../../providers/LocalizationProvider';
import { useTrust } from '../../providers/TrustProvider';

type Feedback = { tone: 'error' | 'success'; text: string } | null;

export default function ProfileScreen() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <SafeAreaView style={styles.loadingScreen} edges={['top']}>
        <BrandLogo width={230} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your account…</Text>
      </SafeAreaView>
    );
  }

  if (!auth.configured) {
    return <AccountSetup />;
  }

  // Signed-out visitors are redirected to /sign-in by the root layout guards.
  return auth.user ? <SignedInProfile key={auth.user.id} /> : null;
}

function SignedInProfile() {
  const router = useRouter();
  const { locale, t } = useLocalization();
  const { user, signOut } = useAuth();
  const { favoriteIds, profile, profileLoading, providerListings, reviews, updateProfile } = useMarketplace();
  const { adminReports, adminVerificationRequests, isAdmin } = useTrust();
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (!user) return null;

  const fullName = profile?.fullName || String(user.user_metadata?.full_name ?? '').trim();
  const displayName =
    fullName || user.email?.split('@')[0] || user.phone || 'BeyBridge user';
  const accountContact = user.email || user.phone || 'BeyBridge account';
  const phoneIsPrimary = Boolean(user.phone && !user.email);
  const contactIsVerified = phoneIsPrimary
    ? Boolean(user.phone_confirmed_at)
    : Boolean(user.email_confirmed_at);
  const verificationLabel = phoneIsPrimary
    ? contactIsVerified
      ? 'Phone verified'
      : 'Phone verification pending'
    : contactIsVerified
      ? 'Email verified'
      : 'Email confirmation pending';
  const initial = displayName.charAt(0).toUpperCase();
  const joined = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-LB' : 'en', { month: 'long', year: 'numeric' }).format(
    new Date(user.created_at)
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    setFeedback(null);
    const { error } = await signOut();

    if (error) {
      setFeedback({ tone: 'error', text: error.message });
      setSigningOut(false);
    }
  };

  const openProviderExperience = () => {
    if (profile?.accountType === 'provider') {
      router.push('/business');
      return;
    }

    if (!profile) {
      setEditing(true);
      return;
    }

    router.push('/provider/manage');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
        <BrandLogo width={238} />

        <AccountStatus />

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text selectable style={styles.profileEmail}>
            {accountContact}
          </Text>

          <View style={styles.accountStatus}>
            <Ionicons
              name={contactIsVerified ? 'checkmark-circle' : 'time-outline'}
              size={17}
              color={contactIsVerified ? Colors.success : Colors.primaryDark}
            />
            <Text style={styles.accountStatusText}>{verificationLabel}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Edit profile')}
            onPress={() => setEditing(true)}
            style={({ pressed }) => [styles.editProfileButton, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="create-outline" size={18} color={Colors.primary} />
            <Text style={styles.editProfileLabel}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="calendar-outline" label="Member since" value={joined} />
          <View style={styles.divider} />
          <InfoRow
            icon="heart-outline"
            label="Saved services"
            value={`${favoriteIds.size} ${favoriteIds.size === 1 ? 'service' : 'services'}`}
            onPress={() => router.push('/favorites')}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="chatbubble-ellipses-outline"
            label="Your reviews"
            value={`${reviews.filter((review) => review.userId === user.id).length} published`}
            onPress={() => router.push('/profile/reviews')}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="call-outline"
            label="Phone"
            value={profileLoading ? 'Loading…' : profile?.phone || user.phone || 'Not added'}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="location-outline"
            label="Default area"
            value={profileLoading ? 'Loading…' : profile?.defaultArea || 'Not selected'}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="language-outline"
            label="Language"
            value={profile?.preferredLanguage === 'ar' ? 'العربية' : 'English'}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="briefcase-outline"
            label="Account type"
            value={profile?.accountType === 'provider' ? 'Service provider' : 'Customer'}
          />
        </View>

        <View style={styles.providerCard}>
          <View style={styles.providerCardIcon}>
            <Ionicons name="briefcase-outline" size={25} color={Colors.primary} />
          </View>
          <View style={styles.providerCardCopy}>
            <Text style={styles.providerCardTitle}>
              {profile?.accountType === 'provider' ? 'Your provider business' : 'Do you offer a service?'}
            </Text>
            <Text style={styles.providerCardText}>
              {profile?.accountType === 'provider'
                ? 'Manage listings, publishing status, availability, and customer reviews.'
                : 'Create your first listing. Provider mode activates only after the listing is saved.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              profile?.accountType === 'provider' ? 'Open provider dashboard' : 'Open service listing'
            )}
            onPress={openProviderExperience}
            style={({ pressed }) => [styles.providerCardButton, pressed && { opacity: 0.72 }]}
          >
            <Ionicons name="arrow-forward" size={19} color={Colors.textOnPrimary} />
          </Pressable>
        </View>

        {isAdmin ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open administrator dashboard"
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [styles.adminCard, pressed && { opacity: 0.75 }]}
          >
            <View style={styles.adminCardIcon}>
              <Ionicons name="shield-checkmark" size={25} color={Colors.primary} />
            </View>
            <View style={styles.providerCardCopy}>
              <Text style={styles.providerCardTitle}>Administrator dashboard</Text>
              <Text style={styles.providerCardText}>
                {adminVerificationRequests.filter((request) => request.status === 'pending').length} verification ·{' '}
                {adminReports.filter((report) => report.status === 'open' || report.status === 'reviewing').length} report items waiting
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={21} color={Colors.primary} />
          </Pressable>
        ) : null}

        <LegalLinks blockedUsers deletion />

        {feedback && (
          <View style={styles.feedback}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
            <Text style={styles.feedbackText}>{feedback.text}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={signingOut}
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutButton, pressed && { opacity: 0.7 }]}
        >
          {signingOut ? (
            <ActivityIndicator color={Colors.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
              <Text style={styles.signOutText}>Sign out</Text>
            </>
          )}
        </Pressable>

        {editing && (
          <ProfileEditor
            visible
            profile={profile}
            fallbackName={displayName}
            onClose={() => setEditing(false)}
            onSave={(updates) => {
              if (updates.accountType === 'customer' && providerListings.length > 0) {
                return Promise.resolve({
                  error: 'Delete your service listings before switching back to a customer account.',
                });
              }
              return updateProfile(updates);
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AccountSetup() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.setupScroll}>
        <BrandLogo width={238} />
        <LanguageToggle />
        <View style={styles.setupIcon}>
          <Ionicons name="key-outline" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.setupTitle}>Account features are unavailable</Text>
        <Text style={styles.setupText}>
          You can still browse services, view business details, and contact providers directly.
        </Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
          <Text style={styles.primaryButtonText}>Browse services</Text>
        </Pressable>
        <LegalLinks />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.infoIcon}>
        <Ionicons name={icon as never} size={19} color={Colors.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={20} color={Colors.primary} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.infoRow}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && styles.infoRowPressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: Colors.surface },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
    backgroundColor: Colors.dangerSoft,
  },
  feedbackSuccess: { backgroundColor: Colors.successSoft },
  feedbackText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 19 },
  feedbackTextSuccess: { color: Colors.success },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  primaryButtonPressed: { backgroundColor: Colors.primaryPressed },
  buttonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: '900' },
  profileScroll: {
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.background,
  },
  profileCard: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  avatar: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderRadius: 36,
    backgroundColor: Colors.primary,
  },
  avatarText: { color: Colors.textOnPrimary, fontSize: FontSize.xl, fontWeight: '900' },
  profileName: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900' },
  profileEmail: { color: Colors.textMuted, fontSize: FontSize.sm },
  accountStatus: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  accountStatusText: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '800' },
  editProfileButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  editProfileLabel: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  infoCard: {
    width: '100%',
    maxWidth: 480,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  providerCard: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  providerCardIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  providerCardCopy: { flex: 1, gap: 3 },
  providerCardTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  providerCardText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  providerCardButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.primary,
  },
  adminCard: {
    width: '100%',
    maxWidth: 480,
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  adminCardIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2 },
  infoRowPressed: { opacity: 0.68 },
  infoIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { color: Colors.textMuted, fontSize: FontSize.xs },
  infoValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  divider: { height: 1, marginVertical: Spacing.sm, backgroundColor: Colors.border },
  signOutButton: {
    width: '100%',
    maxWidth: 480,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  signOutText: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '900' },
  setupScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  setupIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  setupTitle: {
    maxWidth: 320,
    marginTop: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '900',
    textAlign: 'center',
  },
  setupText: {
    maxWidth: 330,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
});
