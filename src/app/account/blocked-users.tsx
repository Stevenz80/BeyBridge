import Text from '@/components/localized-text';
import { RecoveryButton, RecoveryFeedback, RecoveryLayout, recoveryStyles } from '@/components/auth-recovery-form';
import { useAccountScope, useAccountState } from '@/hooks/use-account-state';
import { useAuth } from '@/providers/AuthProvider';
import { useSafety } from '@/providers/SafetyProvider';

export default function BlockedUsersScreen() {
  const { user } = useAuth();
  const { blocks, loading, error, refresh, unblockUser } = useSafety();
  const scope = useAccountScope(user?.id ?? null);
  const [feedback, setFeedback] = useAccountState<string | null>(scope, null);
  const [pending, setPending] = useAccountState<string | null>(scope, null);
  return <RecoveryLayout title="Blocked users">
    <Text style={recoveryStyles.copy}>Blocked users’ listings and reviews are hidden for you. New service requests between you are blocked. Existing requests stay accessible.</Text>
    {!user ? <RecoveryFeedback message="Sign in to manage blocked users." /> : loading ?
      <RecoveryFeedback message="Loading blocked users…" /> : error ? <>
        <RecoveryFeedback error message={error} />
        <RecoveryButton label="Retry blocked users" onPress={() => { void refresh(); }} />
      </> : blocks.length === 0 ? <RecoveryFeedback message="You haven’t blocked anyone." /> : blocks.map(block =>
        <RecoveryButton key={block.blocked_user_id} label={`Unblock ${block.display_name}`} secondary
          disabled={pending !== null} busy={pending === block.blocked_user_id} onPress={() => {
            if (pending) return;
            setPending(block.blocked_user_id);
            void unblockUser(block.blocked_user_id).then(result => {
              if (!scope.isCurrent()) return;
              setPending(null); setFeedback(result.error);
            });
          }} />)}
    {feedback ? <RecoveryFeedback error message={feedback} /> : null}
  </RecoveryLayout>;
}
