import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import TextInput from '@/components/localized-text-input';
import LegalLinks from '@/components/legal-links';
import CommunityAgreement from '@/components/community-agreement';
import LanguageToggle from '@/components/language-toggle';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '@/components/BrandLogo';
import KeyboardAwareScrollView from '@/components/keyboard-aware-scroll-view';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { isValidPhoneNumber, maskPhoneNumber, normalizePhoneNumber } from '@/lib/auth';
import { useAuth } from '@/providers/AuthProvider';
import { useLocalization } from '@/providers/LocalizationProvider';

type AuthMode = 'signIn' | 'signUp';
type AuthMethod = 'email' | 'phone';
type Feedback = { tone: 'error' | 'success'; text: string } | null;

// Keep unfinished provider choices out of the account UI until their external
// credentials and production delivery are ready.
const phoneAuthEnabled = false;
const appleAuthEnabled = false;

// Configured builds route every signed-out visitor here; see the root layout guards.
export default function SignInScreen() {
  return <AuthForm />;
}

function AuthForm() {
  const router = useRouter();
  const { t } = useLocalization();
  const { resendConfirmation, sendPhoneOtp, signIn, signInWithSocial, signUp, verifyPhoneOtp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [fullName, setFullName] = useState('');
  const [accountType, setAccountType] = useState<'customer' | 'provider'>('customer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [phoneForVerification, setPhoneForVerification] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  // Set while an unconfirmed address may need the confirmation email again.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => setResendCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const resetVerification = () => {
    setOtp('');
    setOtpSent(false);
    setPhoneForVerification('');
    setResendCountdown(0);
  };

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    resetVerification();
    setFeedback(null);
  };

  const changeAuthMethod = (nextMethod: AuthMethod) => {
    setAuthMethod(nextMethod);
    setPassword('');
    resetVerification();
    setFeedback(null);
  };

  const validateSignUpDetails = () => {
    if (mode === 'signUp' && !termsAccepted) {
      setFeedback({ tone: 'error', text: 'Agree to the terms and community rules before creating an account.' });
      return false;
    }
    if (mode !== 'signUp' || fullName.trim().length >= 2) return true;
    setFeedback({ tone: 'error', text: 'Enter your name to create an account.' });
    return false;
  };

  const submitEmail = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setFeedback({ tone: 'error', text: 'Enter a valid email address.' });
      return;
    }

    const minimumPasswordLength = mode === 'signUp' ? 8 : 6;
    if (password.length < minimumPasswordLength) {
      setFeedback({
        tone: 'error',
        text: `Password must be at least ${minimumPasswordLength} characters.`,
      });
      return;
    }

    if (!validateSignUpDetails()) return;

    setSubmitting(true);
    setFeedback(null);

    const result =
      mode === 'signIn'
        ? await signIn(cleanEmail, password)
        : await signUp(cleanEmail, password, fullName, accountType);

    if (result.error) {
      setFeedback({ tone: 'error', text: friendlyAuthError(result.error.message) });
      setUnconfirmedEmail(/email not confirmed/i.test(result.error.message) ? cleanEmail : null);
    } else if (result.needsEmailConfirmation) {
      setFeedback({
        tone: 'success',
        text: 'Account created. Check your email to confirm it, then sign in.',
      });
      setUnconfirmedEmail(cleanEmail);
      setPassword('');
    }

    setSubmitting(false);
  };

  const requestPhoneOtp = async () => {
    const cleanPhone = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(cleanPhone)) {
      setFeedback({
        tone: 'error',
        text: 'Enter a valid phone number with its country code, such as +961 3 123 456.',
      });
      return;
    }
    if (!validateSignUpDetails()) return;

    setSubmitting(true);
    setFeedback(null);
    const result = await sendPhoneOtp(cleanPhone, mode, fullName, accountType);
    setSubmitting(false);

    if (result.error) {
      setFeedback({ tone: 'error', text: friendlyAuthError(result.error.message) });
      return;
    }

    setPhone(cleanPhone);
    setPhoneForVerification(cleanPhone);
    setOtpSent(true);
    setOtp('');
    setResendCountdown(60);
    setFeedback({ tone: 'success', text: 'Verification code sent by SMS.' });
  };

  const submitPhoneOtp = async () => {
    const cleanOtp = otp.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setFeedback({ tone: 'error', text: 'Enter the 6-digit verification code.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const result = await verifyPhoneOtp(phoneForVerification, cleanOtp);
    setSubmitting(false);

    if (result.error) {
      setFeedback({ tone: 'error', text: friendlyAuthError(result.error.message) });
    }
  };

  const resendConfirmationEmail = async () => {
    if (!unconfirmedEmail) return;
    setSubmitting(true);
    const result = await resendConfirmation(unconfirmedEmail);
    setSubmitting(false);
    setFeedback(result.error
      ? { tone: 'error', text: friendlyAuthError(result.error.message) }
      : { tone: 'success', text: 'Confirmation email sent. Check your inbox and spam folder.' });
  };

  const submitSocial = async (provider: 'google' | 'apple') => {
    if (mode === 'signUp' && !termsAccepted) {
      setFeedback({ tone: 'error', text: 'Agree to the terms and community rules before creating an account.' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    const result = await signInWithSocial(provider);

    if (result.error) {
      setFeedback({ tone: 'error', text: friendlyAuthError(result.error.message) });
      setSubmitting(false);
    } else if (result.cancelled) {
      setFeedback({ tone: 'error', text: 'Sign-in was cancelled.' });
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.flex}>
        <KeyboardAwareScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.authScroll}
        >
          <BrandLogo width={238} />
          <LanguageToggle />

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
              <ModeButton
                label="Sign in"
                active={mode === 'signIn'}
                onPress={() => changeMode('signIn')}
              />
              <ModeButton
                label="Create account"
                active={mode === 'signUp'}
                onPress={() => changeMode('signUp')}
              />
            </View>

            <View style={styles.socialButtons}>
              <SocialButton
                label="Continue with Google"
                icon="logo-google"
                disabled={submitting}
                onPress={() => void submitSocial('google')}
              />
              {mode === 'signIn' ? (
                // Signing in with Google can create an account, so it carries the same agreement.
                <Text style={styles.socialTerms}>
                  By continuing with Google, you agree to the terms and community rules.
                </Text>
              ) : null}
              {appleAuthEnabled ? (
                <SocialButton
                  label="Continue with Apple"
                  icon="logo-apple"
                  disabled={submitting}
                  onPress={() => void submitSocial('apple')}
                />
              ) : null}
            </View>

            <View style={styles.dividerLabelRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {phoneAuthEnabled && !otpSent ? (
              <View style={styles.authMethodControl}>
                <ModeButton
                  label="Email"
                  active={authMethod === 'email'}
                  onPress={() => changeAuthMethod('email')}
                />
                <ModeButton
                  label="Phone"
                  active={authMethod === 'phone'}
                  onPress={() => changeAuthMethod('phone')}
                />
              </View>
            ) : null}

            {mode === 'signUp' && !otpSent && (
              <>
                <AuthField
                  label="Full name"
                  icon="person-outline"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your name"
                  textContentType="name"
                  autoComplete="name"
                />
                <View style={styles.roleGroup}>
                  <Text style={styles.fieldLabel}>I want to</Text>
                  <View style={styles.segmentedControl}>
                    <ModeButton
                      label="Find services"
                      active={accountType === 'customer'}
                      onPress={() => setAccountType('customer')}
                    />
                    <ModeButton
                      label="Offer services"
                      active={accountType === 'provider'}
                      onPress={() => setAccountType('provider')}
                    />
                  </View>
                  <Text style={styles.roleHint}>
                    {accountType === 'provider'
                      ? 'You will create a listing first. Provider mode activates after the listing is saved.'
                      : 'You can save local professionals and share reviews.'}
                  </Text>
                </View>
              </>
            )}

            {authMethod === 'email' ? (
              <>
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
                  placeholder={mode === 'signUp' ? 'At least 8 characters' : 'Your password'}
                  secureTextEntry={!showPassword}
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  trailing={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(showPassword ? 'Hide password' : 'Show password')}
                      onPress={() => setShowPassword((current) => !current)}
                      style={({ pressed }) => [styles.passwordToggle, pressed && { opacity: 0.75 }]}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={21}
                        color={Colors.textMuted}
                      />
                    </Pressable>
                  }
                />
                {mode === 'signIn' ? (
                  <Pressable accessibilityRole="button" disabled={submitting}
                    accessibilityState={{ disabled: submitting }}
                    onPress={() => router.push({ pathname: '/auth/forgot-password', params: { email: email.trim() } })}
                    style={({ pressed }) => ({ minHeight: 48, justifyContent: 'center', opacity: pressed ? 0.75 : 1 })}>
                    <Text style={{ color: Colors.primary, fontWeight: '700' }}>Forgot password?</Text>
                  </Pressable>
                ) : null}
              </>
            ) : otpSent ? (
              <View style={styles.otpSection}>
                <View style={styles.otpHeading}>
                  <View style={styles.otpIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
                  </View>
                  <View style={styles.otpCopy}>
                    <Text style={styles.otpTitle}>Check your messages</Text>
                    <Text style={styles.otpText}>
                      Enter the code sent to {maskPhoneNumber(phoneForVerification)}
                    </Text>
                  </View>
                </View>
                <AuthField
                  label="6-digit verification code"
                  icon="keypad-outline"
                  value={otp}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={6}
                />
                <View style={styles.otpActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting}
                    onPress={() => {
                      resetVerification();
                      setFeedback(null);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.textAction}>Change number</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={submitting || resendCountdown > 0}
                    onPress={() => void requestPhoneOtp()}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.textAction,
                        resendCountdown > 0 && styles.textActionDisabled,
                      ]}
                    >
                      {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <AuthField
                  label="Mobile number"
                  icon="call-outline"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+961 3 123 456"
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                  autoComplete="tel"
                />
                <Text style={styles.phoneHint}>
                  Include your country code. Lebanese local numbers are formatted as +961 automatically.
                </Text>
              </>
            )}

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
            {unconfirmedEmail && authMethod === 'email' ? (
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => void resendConfirmationEmail()}
                style={({ pressed }) => [styles.secondaryAction, pressed && { opacity: 0.75 }]}>
                <Ionicons name="mail-unread-outline" size={18} color={Colors.primary} />
                <Text style={styles.secondaryActionText}>Resend confirmation email</Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() =>
                void (authMethod === 'email'
                  ? submitEmail()
                  : otpSent
                    ? submitPhoneOtp()
                    : requestPhoneOtp())
              }
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
                    {authMethod === 'phone'
                      ? otpSent
                        ? 'Verify and continue'
                        : 'Send verification code'
                      : mode === 'signIn'
                        ? 'Sign in'
                        : 'Create account'}
                  </Text>
                  <Ionicons name="arrow-forward" size={19} color={Colors.textOnPrimary} />
                </>
              )}
            </Pressable>

            {mode === 'signUp' ? <CommunityAgreement accepted={termsAccepted} onChange={setTermsAccepted} disabled={submitting} /> : null}
            <Text style={styles.privacyNote}>
              {authMethod === 'phone'
                ? 'The verification code is single-use. Standard SMS rates may apply.'
                : 'Your password is handled securely by Supabase and is never stored in the app.'}
            </Text>
            <LegalLinks deletion />
          </View>
        </KeyboardAwareScrollView>
      </View>
    </SafeAreaView>
  );
}

function SocialButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.socialButton,
        pressed && styles.socialButtonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Ionicons name={icon as never} size={21} color={Colors.text} />
      <Text style={styles.socialButtonText}>{label}</Text>
    </Pressable>
  );
}

function friendlyAuthError(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (lowerMessage.includes('email not confirmed')) {
    return 'Confirm your email address first. Use the link we sent, or send it again below.';
  }
  if (lowerMessage.includes('already registered') || lowerMessage.includes('already been registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network request failed')) {
    return 'You appear to be offline. Check your connection and try again.';
  }

  if (lowerMessage.includes('sms provider') || lowerMessage.includes('phone provider')) {
    return 'Phone verification is not enabled yet. Configure an SMS provider in Supabase Auth.';
  }
  if (lowerMessage.includes('provider is not enabled') || lowerMessage.includes('unsupported provider')) {
    return 'This social sign-in method is not enabled yet in Supabase Auth.';
  }
  if (lowerMessage.includes('token has expired') || lowerMessage.includes('otp_expired')) {
    return 'That verification code expired. Request a new code and try again.';
  }
  if (lowerMessage.includes('invalid') && lowerMessage.includes('token')) {
    return 'That verification code is incorrect. Check the SMS and try again.';
  }
  if (lowerMessage.includes('rate limit')) {
    return 'Too many attempts. Wait a moment before requesting another code.';
  }

  return message;
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
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
          accessibilityLabel={label}
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: Colors.surface },
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
  authMethodControl: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  modeButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.sm,
  },
  modeButtonActive: { backgroundColor: Colors.primary },
  modeButtonText: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },
  modeButtonTextActive: { color: Colors.textOnPrimary },
  socialButtons: { gap: Spacing.sm },
  socialButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  socialButtonPressed: { backgroundColor: Colors.primarySoft },
  socialButtonText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  dividerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerLabel: { color: Colors.textSubtle, fontSize: FontSize.xs, fontWeight: '700' },
  fieldGroup: { gap: 7 },
  roleGroup: { gap: 7 },
  fieldLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  roleHint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
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
  passwordToggle: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  phoneHint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  otpSection: { gap: Spacing.md },
  otpHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  otpIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: Colors.primarySoft,
  },
  otpCopy: { flex: 1, gap: 2 },
  otpTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  otpText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  otpActions: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  textAction: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  textActionDisabled: { color: Colors.textSubtle },
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
  socialTerms: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18, textAlign: 'center' },
  secondaryAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  secondaryActionText: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },
  privacyNote: {
    color: Colors.textSubtle,
    fontSize: FontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
  },
});
