import { useCallback, useLayoutEffect, useMemo, useRef, useState,
  type Dispatch, type SetStateAction } from 'react';

type AccountScope = { isCurrent: () => boolean };

export const ACCOUNT_CHANGED_ERROR = 'Your account changed. Please try again.';

export function useAccountScope(accountId: string | null): AccountScope {
  // A fresh identity also distinguishes signing back into the same account
  // after another session; that session's older requests must stay invalid.
  const identity = useMemo(() => ({ accountId }), [accountId]);
  const activeIdentity = useRef<typeof identity | null>(identity);
  useLayoutEffect(() => {
    activeIdentity.current = identity;
    return () => { activeIdentity.current = null; };
  }, [identity]);
  return useMemo(() => ({ isCurrent: () => activeIdentity.current === identity }), [identity]);
}

export function useAccountState<T>(
  scope: AccountScope,
  initialState: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [initialValue] = useState(initialState);
  const [state, setState] = useState(() => ({ scope, value: initialValue }));
  const setAccountState = useCallback<Dispatch<SetStateAction<T>>>((update) => {
    if (!scope.isCurrent()) return;
    setState(previous => {
      if (!scope.isCurrent()) return previous;
      const value = previous.scope === scope ? previous.value : initialValue;
      return { scope, value: typeof update === 'function'
        ? (update as (previous: T) => T)(value) : update };
    });
  }, [initialValue, scope]);

  // Hide old state during the account-change render, before any fetch/effect.
  // Late responses and optimistic rollbacks use their captured scope and are ignored.
  return [state.scope === scope ? state.value : initialValue, setAccountState];
}
