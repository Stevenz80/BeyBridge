import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../../components/BrandLogo';
import ProfileEditor from '../../components/profile-editor';
import { Colors, FontSize, Radius, Shadows, Spacing } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useMarketplace } from '../../providers/MarketplaceProvider';

type AuthMode = 'signIn' | 'signUp';
type Feedback = { tone: 'error' | 'success'; text: string } | null;

export default function ProfileScreen() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <SafeAreaView style={styles.loadingScreen} edges={['top']}>
        <BrandLogo variant="white" width={230} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your account…</Text>
      </SafeAreaView>
    );
  }

  if (!auth.configured) {
    return <AccountSetup />;
  }

  if (auth.user) {
    return <SignedInProfile />;
  }

  return <AuthForm />;
}

function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setFeedback(null);
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFeedback({ tone: 'error', text: 'Enter a valid email address.' });
      return;
    }

    if (password.length < 6) {
      setFeedback({ tone: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (mode === 'signUp' && fullName.trim().length < 2) {
      setFeedback({ tone: 'error', text: 'Enter your name to create an account.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const result =
      mode === 'signIn'
        ? await signIn(cleanEmail, password)
        : await signUp(cleanEmail, password, fullName);

    if (result.error) {
      setFeedback({ tone: 'error', text: result.error.message });
    } else if (result.needsEmailConfirmation) {
      setFeedback({
        tone: 'success',
        text: 'Account created. Check your email to confirm it, then sign in.',
      });
      setPassword('');
    }

    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.authScroll}
        >
          <BrandLogo variant="white" width={238} />

          <View style={styles.authCard}>
            <Text style={styles.authTitle}>
              {mode === 'signIn' ? 'Welcome back' : 'Create your account'}
            </Text>
            <Text style={styles.authSubtitle}>
              {mode === 'signIn'
                ? 'Sign in to keep your trusted services in one place.'
                : 'Join BeyBridge to save providers and manage your account.'}
            </Text>

            <View style={styles.segmentedControl}>
              <ModeButton label="Sign in" active={mode === 'signIn'} onPress={() => changeMode('signIn')} />
              <ModeButton
                label="Create account"
                active={mode === 'signUp'}
                onPress={() => changeMode('signUp')}
              />
            </View>

            {mode === 'signUp' && (
              <AuthField
                label="Full name"
                icon="person-outline"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your name"
                textContentType="name"
                autoComplete="name"
              />
            )}

            <AuthField
              label="Email"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />

            <AuthField
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry={!showPassword}
              textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((current) => !current)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={Colors.textMuted}
                  />
                </Pressable>
              }
            />

            {feedback && (
              <View style={[styles.feedback, feedback.tone === 'success' && styles.feedbackSuccess]}>
                <Ionicons
                  name={feedback.tone === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={18}
                  color={feedback.tone === 'success' ? Colors.success : Colors.danger}
                />
                <Text
                  style={[
                    styles.feedbackText,
                    feedback.tone === 'success' && styles.feedbackTextSuccess,
                  ]}
                >
                  {feedback.text}
                </Text>
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={submit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                submitting && styles.buttonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.textOnPrimary} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {mode === 'signIn' ? 'Sign in' : 'Create account'}
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color={Colors.textOnPrimary} />
                </>
              )}
            </Pressable>

            <Text style={styles.privacyNote}>
              Your password is handled securely by Supabase and is never stored in the app.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SignedInProfile() {
  const { user, signOut } = useAuth();
  const { favoriteIds, profile, profileLoading, reviews, updateProfile } = useMarketplace();
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (!user) return null;

  const fullName = profile?.fullName || String(user.user_metadata?.full_name ?? '').trim();
  const displayName = fullName || user.email?.split('@')[0] || 'BeyBridge user';
  const initial = displayName.charAt(0).toUpperCase();
  const joined = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
        <BrandLogo variant="white" width={238} />

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>

          <View style={styles.accountStatus}>
            <Ionicons
              name={user.email_confirmed_at ? 'checkmark-circle' : 'time-outline'}
              size={17}
              color={user.email_confirmed_at ? Colors.success : Colors.primaryDark}
            />
            <Text style={styles.accountStatusText}>
              {user.email_confirmed_at ? 'Email verified' : 'Email confirmation pending'}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
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
          />
          <View style={styles.divider} />
          <InfoRow
            icon="chatbubble-ellipses-outline"
            label="Your reviews"
            value={`${reviews.filter((review) => review.userId === user.id).length} published`}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="call-outline"
            label="Phone"
            value={profileLoading ? 'Loading…' : profile?.phone || 'Not added'}
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
            onSave={updateProfile}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AccountSetup() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.setupScroll}>
        <BrandLogo variant="white" width={238} />
        <View style={styles.setupIcon}>
          <Ionicons name="key-outline" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.setupTitle}>Connect Supabase to enable accounts</Text>
        <Text style={styles.setupText}>
          The account experience is ready. Add your Supabase project values to a local environment file to turn it on.
        </Text>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Create .env.local</Text>
          <Text style={styles.codeText}>EXPO_PUBLIC_SUPABASE_URL=…</Text>
          <Text style={styles.codeText}>EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…</Text>
        </View>
        <Text style={styles.setupHint}>
          Copy `.env.example`, fill in the values from Supabase → Connect, then reload the app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.modeButton, active && styles.modeButtonActive, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

type AuthFieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon: string;
  trailing?: React.ReactNode;
};

function AuthField({ label, icon, trailing, ...inputProps }: AuthFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon as never} size={20} color={Colors.primary} />
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={Colors.textSubtle}
          selectionColor={Colors.primary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {trailing}
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon as never} size={19} color={Colors.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
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
  authScroll: {
    flexGrow: 1,
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.background,
  },
  authCard: {
    width: '100%',
    maxWidth: 480,
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  authTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
  authSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  modeButton: {
    minHeight: 42,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  modeButtonActive: { backgroundColor: Colors.primary },
  modeButtonText: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },
  modeButtonTextActive: { color: Colors.textOnPrimary },
  fieldGroup: { gap: 7 },
  fieldLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  inputWrap: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  input: { flex: 1, height: 52, color: Colors.text, fontSize: FontSize.md },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Radius.sm,
    backgroundColor: '#FFF1F2',
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
  privacyNote: {
    color: Colors.textSubtle,
    fontSize: FontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
  },
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
    minHeight: 42,
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
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 2 },
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
    borderColor: '#F1C9CF',
    borderRadius: Radius.md,
    backgroundColor: '#FFF8F8',
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
  codeCard: {
    width: '100%',
    maxWidth: 480,
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  codeLabel: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '900' },
  codeText: { color: Colors.text, fontSize: 11, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  setupHint: {
    maxWidth: 330,
    color: Colors.textSubtle,
    fontSize: FontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
  },
});
