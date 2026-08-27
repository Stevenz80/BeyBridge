import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimePostgresInsertPayload } from '@supabase/supabase-js';
import {
  getPushOptInPreferenceState,
  getPushRegistrationUnavailableReason,
  getStoredPushToken,
  hasGrantedPushPermission,
  registerCurrentDeviceForPush,
  unregisterCurrentDeviceFromPush,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import type { AccountNotification, NotificationKind } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  route: string;
  source_type: AccountNotification['sourceType'];
  source_id: string;
  source_event: string;
  read_at: string | null;
  created_at: string;
};

type MutationResult = { error: string | null };

type PushHealthRow = {
  enabled_device_count: number;
  latest_state: 'pending' | 'sending' | 'ticketed' | 'delivered' | 'failed' | 'cancelled' | null;
  latest_error_code: string;
  latest_status_message: string;
  latest_updated_at: string | null;
  latest_notification_created_at: string | null;
};

type NotificationContextValue = {
  notifications: AccountNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  pushEnabled: boolean;
  pushBusy: boolean;
  pushTestBusy: boolean;
  pushMessage: string | null;
  pushSupported: boolean;
  pushUnavailableReason: string | null;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<MutationResult>;
  markAllAsRead: () => Promise<MutationResult>;
  deleteNotification: (notificationId: string) => Promise<MutationResult>;
  enablePush: () => Promise<MutationResult>;
  disablePush: () => Promise<MutationResult>;
  sendTestPush: () => Promise<MutationResult>;
  refreshPushStatus: () => Promise<void>;
  clearError: () => void;
};

const NOTIFICATION_COLUMNS = [
  'id',
  'user_id',
  'kind',
  'title',
  'body',
  'route',
  'source_type',
  'source_id',
  'source_event',
  'read_at',
  'created_at',
].join(',');

const NotificationContext = createContext<NotificationContextValue | null>(null);

function mapNotification(row: NotificationRow): AccountNotification {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    route: row.route,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceEvent: row.source_event,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { configured, user } = useAuth();
  const [notifications, setNotifications] = useState<AccountNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const pushTestGeneration = useRef(0);

  const refreshPushHealth = useCallback(async (): Promise<PushHealthRow | null> => {
    if (!configured || !user) return null;

    const { data, error: healthError } = await supabase.rpc('get_my_push_delivery_health');
    if (healthError) return null;

    const health = ((data as unknown as PushHealthRow[] | null) ?? [])[0] ?? null;
    return health;
  }, [configured, user]);

  const refreshPushStatus = useCallback(async () => {
    const health = await refreshPushHealth();
    if (!health?.latest_status_message) return;

    if (health.latest_state === 'failed' || health.latest_state === 'cancelled') {
      setError(health.latest_status_message);
      return;
    }

    setPushMessage(health.latest_status_message);
  }, [refreshPushHealth]);

  const refreshNotifications = useCallback(async () => {
    const generation = ++loadGeneration.current;

    if (!configured || !user) {
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('user_notifications')
      .select(NOTIFICATION_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(100);

    if (generation !== loadGeneration.current) return;

    if (loadError) {
      setError(loadError.message);
    } else {
      setNotifications((data as unknown as NotificationRow[]).map(mapNotification));
      setError(null);
    }
    setLoading(false);
  }, [configured, user]);

  useEffect(() => {
    const timeout = setTimeout(() => void refreshNotifications(), 0);
    return () => {
      clearTimeout(timeout);
      loadGeneration.current += 1;
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (!configured || !user) return;

    const channel = supabase
      .channel(`account-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresInsertPayload<NotificationRow>) => {
          const notification = mapNotification(payload.new);
          setNotifications((current) => [
            notification,
            ...current.filter((item) => item.id !== notification.id),
          ]);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [configured, user]);

  useEffect(() => {
    let cancelled = false;

    async function refreshPushRegistration() {
      const token = getStoredPushToken();
      if (!configured || !user) {
        if (!cancelled) setPushEnabled(false);
        return;
      }

      const preference = getPushOptInPreferenceState();
      const permissionWasAlreadyGranted =
        preference === 'unknown' ? await hasGrantedPushPermission() : false;
      const shouldRestoreRegistration =
        preference !== 'disabled' &&
        (preference === 'enabled' || Boolean(token) || permissionWasAlreadyGranted);
      if (
        shouldRestoreRegistration &&
        getPushRegistrationUnavailableReason() === null
      ) {
        const result = await registerCurrentDeviceForPush();
        if (!cancelled) {
          setPushEnabled(!result.error && Boolean(result.token));
          if (result.error) setPushMessage(result.error);
        }
        return;
      }

      if (!token) {
        if (!cancelled) setPushEnabled(false);
        return;
      }

      const { data, error: registrationError } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('expo_push_token', token)
        .eq('enabled', true)
        .maybeSingle();

      if (!cancelled) {
        setPushEnabled(!registrationError && Boolean(data));
      }
    }

    void refreshPushRegistration();
    return () => {
      cancelled = true;
    };
  }, [configured, user]);

  const markAsRead = useCallback(
    async (notificationId: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to update notifications.' };
      const readAt = new Date().toISOString();
      const previous = notifications;
      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, readAt } : item))
      );

      const { error: updateError } = await supabase
        .from('user_notifications')
        .update({ read_at: readAt })
        .eq('id', notificationId)
        .is('read_at', null);

      if (updateError) {
        setNotifications(previous);
        return { error: updateError.message };
      }
      return { error: null };
    },
    [notifications, user]
  );

  const markAllAsRead = useCallback(async (): Promise<MutationResult> => {
    if (!user) return { error: 'Sign in to update notifications.' };
    if (!notifications.some((item) => !item.readAt)) return { error: null };

    const readAt = new Date().toISOString();
    const previous = notifications;
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));

    const { error: updateError } = await supabase
      .from('user_notifications')
      .update({ read_at: readAt })
      .is('read_at', null);

    if (updateError) {
      setNotifications(previous);
      return { error: updateError.message };
    }
    return { error: null };
  }, [notifications, user]);

  const deleteNotification = useCallback(
    async (notificationId: string): Promise<MutationResult> => {
      if (!user) return { error: 'Sign in to remove notifications.' };
      const previous = notifications;
      setNotifications((current) => current.filter((item) => item.id !== notificationId));

      const { error: deleteError } = await supabase
        .from('user_notifications')
        .delete()
        .eq('id', notificationId);

      if (deleteError) {
        setNotifications(previous);
        return { error: deleteError.message };
      }
      return { error: null };
    },
    [notifications, user]
  );

  const enablePush = useCallback(async (): Promise<MutationResult> => {
    setPushBusy(true);
    setPushMessage(null);
    const result = await registerCurrentDeviceForPush();
    setPushBusy(false);
    setPushEnabled(!result.error && Boolean(result.token));
    setPushMessage(result.error ?? 'This device is registered for push alerts.');
    if (!result.error) void refreshPushStatus();
    return { error: result.error };
  }, [refreshPushStatus]);

  const disablePush = useCallback(async (): Promise<MutationResult> => {
    setPushBusy(true);
    setPushMessage(null);
    const result = await unregisterCurrentDeviceFromPush();
    setPushBusy(false);
    if (!result.error) setPushEnabled(false);
    setPushMessage(result.error ?? 'Push alerts are disabled on this device.');
    return result;
  }, []);

  const sendTestPush = useCallback(async (): Promise<MutationResult> => {
    if (!user) return { error: 'Sign in to test notifications.' };
    if (!pushEnabled) return { error: 'Enable notifications on this device first.' };

    setPushTestBusy(true);
    setPushMessage(null);
    setError(null);
    const queuedAt = Date.now();
    const { error: testError } = await supabase.rpc('send_test_push_notification');
    setPushTestBusy(false);

    if (testError) return { error: testError.message };

    setPushMessage('Test alert queued. Put BeyBridge in the background and check your tray.');
    const generation = ++pushTestGeneration.current;

    void (async () => {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        if (generation !== pushTestGeneration.current) return;

        const health = await refreshPushHealth();
        const isCurrentTest =
          health?.latest_notification_created_at &&
          new Date(health.latest_notification_created_at).getTime() >= queuedAt - 2_000;
        if (!health || !isCurrentTest) continue;

        if (health.latest_state === 'failed' || health.latest_state === 'cancelled') {
          setPushMessage(null);
          setError(health.latest_status_message || 'The test alert could not be delivered.');
          return;
        }

        if (health.latest_state === 'ticketed' || health.latest_state === 'delivered') {
          setPushMessage('Test alert sent. Check your Android notification tray.');
          return;
        }
      }

      if (generation === pushTestGeneration.current) {
        setPushMessage('The test alert is still queued. Pull to refresh in a moment.');
      }
    })();

    return { error: null };
  }, [pushEnabled, refreshPushHealth, user]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
      loading,
      error,
      pushEnabled,
      pushBusy,
      pushTestBusy,
      pushMessage,
      pushSupported: getPushRegistrationUnavailableReason() === null,
      pushUnavailableReason: getPushRegistrationUnavailableReason(),
      refreshNotifications,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      enablePush,
      disablePush,
      sendTestPush,
      refreshPushStatus,
      clearError: () => setError(null),
    }),
    [
      deleteNotification,
      disablePush,
      enablePush,
      error,
      loading,
      markAllAsRead,
      markAsRead,
      notifications,
      pushBusy,
      pushEnabled,
      pushMessage,
      pushTestBusy,
      refreshPushStatus,
      refreshNotifications,
      sendTestPush,
    ]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = React.use(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
