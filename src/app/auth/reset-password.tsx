import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Text from '@/components/localized-text';
import { RecoveryButton, RecoveryFeedback, RecoveryField, RecoveryLayout, recoveryStyles } from '@/components/auth-recovery-form';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/providers/AuthProvider';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { user, loading, passwordRecovery, cancelPasswordRecovery } = useAuth();
  const back = () => { cancelPasswordRecovery(); router.replace('/profile'); };
  if (passwordRecovery.status === 'verifying' || loading) {
    return (
      <RecoveryLayout title="Checking your reset link">
        <ActivityIndicator color={Colors.primary} />
        <Text style={recoveryStyles.copy}>Please wait while we verify your email link.</Text>
      </RecoveryLayout>
    );
  }
  if (passwordRecovery.status === 'complete' && passwordRecovery.userId === user?.id) {
    return (
      <RecoveryLayout title="Password updated">
        <RecoveryFeedback message="Your new password is ready to use. You’re signed in to your account." />
        <RecoveryButton label="Continue to account" onPress={back} />
      </RecoveryLayout>
    );
  }
  if (passwordRecovery.status !== 'ready' || passwordRecovery.userId !== user?.id) {
    return (
      <RecoveryLayout title="Reset link unavailable">
        <RecoveryFeedback error message={passwordRecovery.error ?? 'Open the reset link from your email to choose a new password.'} />
        <RecoveryButton label="Request a new reset link" onPress={() => {
          cancelPasswordRecovery(); router.replace('/auth/forgot-password');
        }} />
        <RecoveryButton label="Back to account" secondary onPress={back} />
      </RecoveryLayout>
    );
  }
  return <ResetPasswordForm key={`${user.id}:${passwordRecovery.attempt}`} />;
}

function ResetPasswordForm() {
  const { user, resetRecoveredPassword, cancelPasswordRecovery } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const submit = async () => {
    if (pending.current) return;
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    const result = await resetRecoveredPassword(password);
    pending.current = false;
    if (!mounted.current) return;
    setSubmitting(false);
    if (result.error) setError(result.error.message);
  };

  return (
    <RecoveryLayout title="Choose a new password">
      <Text style={recoveryStyles.copy}>You’re resetting the password for:</Text>
      <Text selectable style={recoveryStyles.email}>{user?.email}</Text>
      <RecoveryField label="New password" value={password} onChangeText={setPassword}
        placeholder="At least 8 characters" secureTextEntry={!showPassword} editable={!submitting}
        autoComplete="new-password" textContentType="newPassword" />
      <RecoveryField label="Confirm new password" value={confirmation} onChangeText={setConfirmation}
        placeholder="Enter your new password again" secureTextEntry={!showPassword} editable={!submitting}
        autoComplete="new-password" textContentType="newPassword" />
      <RecoveryButton label={showPassword ? 'Hide password' : 'Show password'} secondary
        onPress={() => setShowPassword(value => !value)} />
      {error ? <RecoveryFeedback error message={error} /> : null}
      <RecoveryButton label="Update password" busy={submitting} onPress={() => { void submit(); }} />
      <RecoveryButton label="Back to account" secondary onPress={() => {
        cancelPasswordRecovery(); router.replace('/profile');
      }} />
    </RecoveryLayout>
  );
}
