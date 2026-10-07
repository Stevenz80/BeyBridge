import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAccountScope, useAccountState } from '@/hooks/use-account-state';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

type Block = { blocked_user_id: string; display_name: string };
type Result = { error: string | null };
type SafetyContextValue = {
  blocks: Block[]; blockedIds: Set<string>; loading: boolean; error: string | null;
  refresh: () => Promise<void>;
  blockUser: (id: string, name: string) => Promise<Result>;
  unblockUser: (id: string) => Promise<Result>;
};
const Context = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const { configured, user } = useAuth();
  const scope = useAccountScope(user?.id ?? null);
  const [blocks, setBlocks] = useAccountState<Block[]>(scope, []);
  const [loading, setLoading] = useAccountState(scope, false);
  const [error, setError] = useAccountState<string | null>(scope, null);
  const refresh = useCallback(async () => {
    if (!configured || !user) return;
    setLoading(true);
    setError(null);
    try {
      const result = await supabase.from('user_blocks').select('blocked_user_id, display_name').eq('user_id', user.id);
      if (result.error) setError('Your blocked users could not be loaded. Please retry.');
      else setBlocks(result.data ?? []);
    } catch { setError('Your blocked users could not be loaded. Please retry.'); }
    finally { setLoading(false); }
  }, [configured, user, setLoading, setError, setBlocks]);
  useEffect(() => { void refresh(); }, [refresh]);
  const blockUser = useCallback(async (id: string, name: string): Promise<Result> => {
    if (!user) return { error: 'Sign in to block a user.' };
    if (id === user.id) return { error: 'You cannot block yourself.' };
    const block = { blocked_user_id: id, display_name: name.trim().slice(0, 120) || 'BeyBridge user' };
    try {
      const result = await supabase.from('user_blocks').upsert({ user_id: user.id, ...block },
        { onConflict: 'user_id,blocked_user_id', ignoreDuplicates: true });
      if (!scope.isCurrent()) return { error: 'Your account changed. Please try again.' };
      if (result.error) return { error: 'This user could not be blocked. Please retry.' };
      setBlocks(previous => [...previous.filter(item => item.blocked_user_id !== id), block]);
      return { error: null };
    } catch { return { error: 'This user could not be blocked. Please retry.' }; }
  }, [scope, user, setBlocks]);
  const unblockUser = useCallback(async (id: string): Promise<Result> => {
    if (!user) return { error: 'Sign in to manage blocked users.' };
    try {
      const result = await supabase.from('user_blocks').delete().eq('user_id', user.id).eq('blocked_user_id', id);
      if (!scope.isCurrent()) return { error: 'Your account changed. Please try again.' };
      if (result.error) return { error: 'This user could not be unblocked. Please retry.' };
      setBlocks(previous => previous.filter(item => item.blocked_user_id !== id));
      return { error: null };
    } catch { return { error: 'This user could not be unblocked. Please retry.' }; }
  }, [scope, user, setBlocks]);
  const value = useMemo(() => ({ blocks, blockedIds: new Set(blocks.map(block => block.blocked_user_id)),
    loading, error, refresh, blockUser, unblockUser }), [blocks, loading, error, refresh, blockUser, unblockUser]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSafety() {
  const value = useContext(Context);
  if (!value) throw new Error('SafetyProvider is required');
  return value;
}
