import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import Text from '@/components/localized-text';
import { RecoveryButton, RecoveryFeedback, RecoveryField, RecoveryLayout, recoveryStyles } from '@/components/auth-recovery-form';
import { useAccountScope, useAccountState } from '@/hooks/use-account-state';
import { useAuth } from '@/providers/AuthProvider';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { user, deleteAccount } = useAuth();
  const scope = useAccountScope(user?.id ?? null);
  const [confirmation, setConfirmation] = useAccountState(scope, '');
  const [error, setError] = useAccountState<string | null>(scope, null);
  const [busy, setBusy] = useAccountState(scope, false);
  const [deleted, setDeleted] = useState(false);
  const pending = useRef(false);

  const submit = async () => {
    if (pending.current || confirmation !== 'DELETE' || !user) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    const result = await deleteAccount();
    pending.current = false;
    // Successful deletion deliberately signs this account out. Ignore a result
    // from an earlier account if a different account is now signed in.
    if (result.deleted) { setDeleted(true); return; }
    if (!scope.isCurrent()) return;
    setBusy(false);
    if (result.error) setError(result.error.message);
  };

  if (deleted) return <RecoveryLayout title="Account deleted">
    <RecoveryFeedback message="Your BeyBridge account and associated data have been deleted." />
    <RecoveryButton label="Return to home" onPress={() => router.replace('/')} />
  </RecoveryLayout>;

  return <RecoveryLayout title="Delete your account">
    <Text style={recoveryStyles.copy}>Deletion is permanent. It removes your profile, favorites, reviews, service listings, verification documents, notifications, and associated service requests and their history. Shared requests will also disappear for the other participant. Save any records you need before continuing.</Text>
    <RecoveryButton label="Read account deletion details" secondary onPress={() => router.push('/legal/deletion')} />
    {!user ? <>
      <RecoveryFeedback message="Sign in to the account you want to delete, then return to this page." />
      <RecoveryButton label="Sign in" onPress={() => router.push('/profile')} />
    </> : <>
      <Text selectable style={recoveryStyles.email}>{user.email || user.phone || 'Your signed-in account'}</Text>
      <Text style={recoveryStyles.copy}>Type DELETE to confirm. This cannot be undone.</Text>
      <RecoveryField label="Deletion confirmation" value={confirmation} onChangeText={setConfirmation}
        editable={!busy} autoComplete="off" placeholder="DELETE" />
      {error ? <RecoveryFeedback error message={error} /> : null}
      <RecoveryButton label="Permanently delete account" busy={busy} disabled={confirmation !== 'DELETE'}
        onPress={() => { void submit(); }} />
      <RecoveryButton label="Keep my account" secondary disabled={busy} onPress={() => router.replace('/profile')} />
    </>}
  </RecoveryLayout>;
}
