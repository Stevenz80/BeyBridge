import { useRef } from 'react';
import { useRouter } from 'expo-router';
import { RecoveryButton, RecoveryFeedback } from '@/components/auth-recovery-form';
import { useAccountScope, useAccountState } from '@/hooks/use-account-state';
import { confirmAction } from '@/lib/confirm-action';
import { useAuth } from '@/providers/AuthProvider';
import { useSafety } from '@/providers/SafetyProvider';

export default function BlockUserButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { blockUser } = useSafety();
  const scope = useAccountScope(`${user?.id ?? 'anonymous'}:${userId}`);
  const [error, setError] = useAccountState<string | null>(scope, null);
  const [busy, setBusy] = useAccountState(scope, false);
  const pending = useRef(false);
  if (userId === user?.id) return null;
  const confirm = () => {
    if (!user) { router.push('/profile'); return; }
    confirmAction({ title: `Block ${name}?`,
      message: 'Their listings and reviews will be hidden for you. New in-app service requests between you will be blocked. Existing requests stay accessible; external calls and chats are unaffected. You can unblock them from your account.',
      cancelLabel: 'Cancel', confirmLabel: 'Block user', destructive: true,
      onConfirm: () => {
        if (!scope.isCurrent() || pending.current) return;
        pending.current = true;
        setBusy(true);
        void blockUser(userId, name).then(result => {
          pending.current = false;
          if (!scope.isCurrent()) return;
          setBusy(false);
          setError(result.error);
        });
      } });
  };
  return <>
    <RecoveryButton label={`Block ${name}`} secondary busy={busy} onPress={confirm} />
    {error ? <RecoveryFeedback error message={error} /> : null}
  </>;
}
