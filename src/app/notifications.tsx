import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { getSafeNotificationRoute } from '@/lib/notifications';
import type { AccountNotification, NotificationKind } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useNotifications } from '@/providers/NotificationProvider';

const KIND_ICON: Record<NotificationKind, React.ComponentProps<typeof Ionicons>['name']> = {
  request_created: 'receipt-outline',
  request_status: 'swap-horizontal-outline',
  verification_submitted: 'shield-outline',
  verification_status: 'shield-checkmark-outline',
  report_status: 'flag-outline',
  provider_moderation: 'briefcase-outline',
  push_test: 'paper-plane-outline',
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    pushEnabled,
    pushBusy,
    pushTestBusy,
    pushMessage,
    pushSupported,
    pushUnavailableReason,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    enablePush,
    disablePush,
    sendTestPush,
    refreshPushStatus,
  } = useNotifications();
  const [actionError, setActionError] = useState<string | null>(null);

  const openNotification = async (notification: AccountNotification) => {
    setActionError(null);
    if (!notification.readAt) {
      const result = await markAsRead(notification.id);
      if (result.error) setActionError(result.error);
    }

    const route = getSafeNotificationRoute(notification.route);
    if (route && route !== '/notifications') router.push(route as Href);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <View style={styles.emptyIcon}>
          <Ionicons name="notifications-outline" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Sign in for account updates</Text>
        <Text style={styles.emptyText}>
          Request replies, verification decisions, and report outcomes will appear here.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/profile')}>
          <Text style={styles.primaryButtonText}>Go to profile</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void Promise.all([refreshNotifications(), refreshPushStatus()])}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.eyebrow}>ACCOUNT ACTIVITY</Text>
            <Text style={styles.title}>
              {unreadCount ? `${unreadCount} unread` : 'You are all caught up'}
            </Text>
          </View>
          {unreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                setActionError(null);
                const result = await markAllAsRead();
                if (result.error) setActionError(result.error);
              }}
              style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            >
              <Text style={styles.textButtonLabel}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.pushCard}>
          <View style={[styles.pushIcon, pushEnabled && styles.pushIconEnabled]}>
            <Ionicons
              name={pushEnabled ? 'notifications' : 'notifications-outline'}
              size={23}
              color={pushEnabled ? Colors.success : Colors.primary}
            />
          </View>
          <View style={styles.pushCopy}>
            <Text style={styles.pushTitle}>
              {pushEnabled
                ? 'This device is registered'
                : pushSupported
                  ? 'Get device alerts'
                  : 'Device alerts unavailable'}
            </Text>
            <Text style={styles.pushText}>
              {pushSupported
                ? 'Opt in for request, trust, and listing updates when you are away from the app.'
                : pushUnavailableReason}
            </Text>
            {pushMessage ? (
              <Text style={[styles.pushMessage, pushEnabled && styles.pushMessageSuccess]}>
                {pushMessage}
              </Text>
            ) : null}
            {pushEnabled ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send a test push notification"
                accessibilityState={{ busy: pushTestBusy }}
                disabled={pushBusy || pushTestBusy}
                onPress={async () => {
                  setActionError(null);
                  const result = await sendTestPush();
                  if (result.error) setActionError(result.error);
                }}
                style={({ pressed }) => [
                  styles.testButton,
                  pressed && styles.pressed,
                  (pushBusy || pushTestBusy) && styles.disabled,
                ]}
              >
                {pushTestBusy ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="paper-plane-outline" size={16} color={Colors.primary} />
                )}
                <Text style={styles.testButtonLabel}>
                  {pushTestBusy ? 'Queueing test…' : 'Send test alert'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {pushSupported ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: pushBusy, checked: pushEnabled }}
              disabled={pushBusy}
              onPress={() => void (pushEnabled ? disablePush() : enablePush())}
              style={({ pressed }) => [
                styles.pushButton,
                pushEnabled && styles.pushButtonSecondary,
                pressed && styles.pressed,
                pushBusy && styles.disabled,
              ]}
            >
              {pushBusy ? (
                <ActivityIndicator size="small" color={Colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    styles.pushButtonLabel,
                    pushEnabled && styles.pushButtonLabelSecondary,
                  ]}
                >
                  {pushEnabled ? 'Turn off' : 'Enable'}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>

        {error || actionError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color={Colors.danger} />
            <Text style={styles.errorText}>{actionError ?? error}</Text>
          </View>
        ) : null}

        {loading && notifications.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading notifications…</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-done" size={31} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Nothing new yet</Text>
            <Text style={styles.emptyText}>
              Updates about your service requests, provider listing, verification, and reports will
              stay organized here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onOpen={() => void openNotification(notification)}
                onDelete={async () => {
                  setActionError(null);
                  const result = await deleteNotification(notification.id);
                  if (result.error) setActionError(result.error);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationCard({
  notification,
  onOpen,
  onDelete,
}: {
  notification: AccountNotification;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const unread = !notification.readAt;
  const created = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(notification.createdAt));

  return (
    <View style={[styles.notificationCard, unread && styles.notificationCardUnread]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.notificationMain, pressed && styles.pressed]}
      >
        <View style={[styles.notificationIcon, unread && styles.notificationIconUnread]}>
          <Ionicons
            name={KIND_ICON[notification.kind]}
            size={21}
            color={unread ? Colors.textOnPrimary : Colors.primary}
          />
        </View>
        <View style={styles.notificationCopy}>
          <View style={styles.notificationTitleRow}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>
          {notification.body ? <Text style={styles.notificationBody}>{notification.body}</Text> : null}
          <Text style={styles.notificationTime}>{created}</Text>
        </View>
        {getSafeNotificationRoute(notification.route) !== '/notifications' ? (
          <Ionicons name="chevron-forward" size={20} color={Colors.textSubtle} />
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${notification.title}`}
        hitSlop={8}
        onPress={onDelete}
        style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
      >
        <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  summaryRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  eyebrow: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900', letterSpacing: 1 },
  title: { marginTop: 3, color: Colors.text, fontSize: FontSize.xl, fontWeight: '900' },
  textButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.sm },
  textButtonLabel: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  pushCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  pushIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  pushIconEnabled: { backgroundColor: Colors.successSoft },
  pushCopy: { flex: 1, gap: 3 },
  pushTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  pushText: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  pushMessage: { color: Colors.danger, fontSize: FontSize.xs, lineHeight: 17 },
  pushMessageSuccess: { color: Colors.success },
  testButton: {
    minHeight: 48,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  testButtonLabel: { color: Colors.primary, fontSize: FontSize.xs, fontWeight: '900' },
  pushButton: {
    minWidth: 76,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  pushButtonSecondary: {
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  pushButtonLabel: { color: Colors.textOnPrimary, fontSize: FontSize.xs, fontWeight: '900' },
  pushButtonLabelSecondary: { color: Colors.primary },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 20 },
  loadingCard: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  emptyCard: {
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderRadius: 33,
    backgroundColor: Colors.primarySoft,
  },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  emptyText: {
    maxWidth: 360,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    justifyContent: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  list: { gap: Spacing.sm },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  notificationCardUnread: { borderColor: Colors.borderStrong, backgroundColor: Colors.primarySoft },
  notificationMain: {
    minHeight: 94,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingRight: Spacing.sm,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  notificationIconUnread: { backgroundColor: Colors.primary },
  notificationCopy: { flex: 1, gap: 4 },
  notificationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  notificationTitle: { flex: 1, color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  notificationBody: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  notificationTime: { color: Colors.textSubtle, fontSize: 11, fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  deleteButton: {
    width: 48,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.6 },
});
