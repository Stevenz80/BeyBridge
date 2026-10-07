import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Text from '@/components/localized-text';
import { RecoveryButton, RecoveryFeedback, RecoveryField, RecoveryLayout, recoveryStyles } from '@/components/auth-recovery-form';
import { isValidEmail } from '@/lib/auth';
import { useAuth } from '@/providers/AuthProvider';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { configured, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async () => {
    if (pending.current || cooldown || !configured) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    const result = await requestPasswordReset(cleanEmail);
    pending.current = false;
    if (!mounted.current) return;
    setSubmitting(false);
    if (result.error) setError(result.error.message);
    else {
      setSent(true);
      setCooldown(60);
    }
  };

  return (
    <RecoveryLayout title="Reset your password">
      <Text style={recoveryStyles.copy}>Enter your account email and we’ll send a link to choose a new password.</Text>
      {!configured ? <RecoveryFeedback error message="Password recovery is not available yet." /> : null}
      <RecoveryField label="Email" value={email} keyboardType="email-address" autoComplete="email"
        textContentType="emailAddress" placeholder="you@example.com" editable={!submitting}
        onChangeText={value => { setEmail(value); setSent(false); setError(null); }} />
      {sent ? <RecoveryFeedback message="If an account uses this email, you’ll receive a reset link shortly." /> : null}
      {sent ? <Text style={recoveryStyles.copy}>Check your spam folder too. Open the latest email link on the device where you want to reset your password.</Text> : null}
      {error ? <RecoveryFeedback error message={error} /> : null}
      {cooldown ? <Text style={recoveryStyles.copy}>{`You can request another link in ${cooldown}s.`}</Text> : null}
      <RecoveryButton label={sent ? 'Send another reset link' : 'Send reset link'} busy={submitting}
        disabled={!configured || cooldown > 0} onPress={() => { void submit(); }} />
      <RecoveryButton label="Back to account" secondary onPress={() => router.replace('/profile')} />
    </RecoveryLayout>
  );
}
