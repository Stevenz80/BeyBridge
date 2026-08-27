import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { ContentReport, VerificationRequest } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useTrust } from '@/providers/TrustProvider';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const { user } = useAuth();
  const {
    adminLoading,
    adminReports,
    adminVerificationRequests,
    isAdmin,
    moderationActions,
    refreshTrustData,
    trustError,
    trustLoading,
  } = useTrust();

  useFocusEffect(
    useCallback(() => {
      void refreshTrustData();
    }, [refreshTrustData])
  );

  const pendingVerifications = useMemo(
    () => adminVerificationRequests.filter((request) => request.status === 'pending'),
    [adminVerificationRequests]
  );
  const openReports = useMemo(
    () => adminReports.filter((report) => report.status === 'open' || report.status === 'reviewing'),
    [adminReports]
  );
  const completedReports = useMemo(
    () => adminReports.filter((report) => report.status === 'resolved' || report.status === 'dismissed'),
    [adminReports]
  );
  const suspendedCount = useMemo(() => {
    const latestByProvider = new Map<string, 'suspend' | 'restore'>();
    moderationActions.forEach((action) => {
      if (!latestByProvider.has(action.providerId)) latestByProvider.set(action.providerId, action.action);
    });
    return [...latestByProvider.values()].filter((action) => action === 'suspend').length;
  }, [moderationActions]);

  if (!user) {
    return (
      <AccessState
        icon="lock-closed-outline"
        title="Sign in required"
        message="Sign in with an administrator account to open this dashboard."
        action="Go to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (adminLoading) {
    return <AccessState loading title="Checking administrator access" message="One moment…" />;
  }

  if (!isAdmin) {
    return (
      <AccessState
        icon="shield-outline"
        title="Administrator access required"
        message="This account does not have a platform-administrator role."
        action="Back to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: t('Administration') }} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark" size={31} color={Colors.primary} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>BEYBRIDGE OPERATIONS</Text>
          <Text style={styles.title}>Trust & safety dashboard</Text>
          <Text style={styles.subtitle}>Review provider evidence, investigate reports, and record every moderation action.</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Verification" value={pendingVerifications.length} icon="shield-outline" />
        <StatCard label="Open reports" value={openReports.length} icon="flag-outline" />
        <StatCard label="Suspended" value={suspendedCount} icon="pause-circle-outline" />
      </View>

      {trustError ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={19} color={Colors.danger} />
          <Text style={styles.errorText}>{trustError}</Text>
        </View>
      ) : null}

      {trustLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Refreshing queues…</Text>
        </View>
      ) : null}

      <QueueSection
        title="Provider verification"
        subtitle="Pending identity and business-evidence reviews"
        icon="shield-checkmark-outline"
        empty="No provider verification requests are waiting."
      >
        {pendingVerifications.map((request) => (
          <VerificationQueueCard
            key={request.id}
            request={request}
            onPress={() =>
              router.push({ pathname: '/admin/verification/[id]', params: { id: request.id } })
            }
          />
        ))}
      </QueueSection>

      <QueueSection
        title="Content reports"
        subtitle="Open and in-review customer reports"
        icon="flag-outline"
        empty="No unresolved reports are waiting."
      >
        {openReports.map((report) => (
          <ReportQueueCard
            key={report.id}
            report={report}
            onPress={() => router.push({ pathname: '/admin/report/[id]', params: { id: report.id } })}
          />
        ))}
      </QueueSection>

      <QueueSection
        title="Report history"
        subtitle="Resolved and dismissed reports remain available for audit and restoration actions"
        icon="archive-outline"
        empty="No report decisions have been completed yet."
      >
        {completedReports.map((report) => (
          <ReportQueueCard
            key={report.id}
            report={report}
            onPress={() => router.push({ pathname: '/admin/report/[id]', params: { id: report.id } })}
          />
        ))}
      </QueueSection>

      <Text style={styles.auditNote}>
        Completed decisions remain in Supabase as an audit trail and are not silently deleted.
      </Text>
    </ScrollView>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as never} size={19} color={Colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QueueSection({
  title,
  subtitle,
  icon,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon as never} size={21} color={Colors.primary} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {hasChildren ? children : <Text style={styles.emptyText}>{empty}</Text>}
    </View>
  );
}

function VerificationQueueCard({ request, onPress }: { request: VerificationRequest; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.queueCard, pressed && styles.pressed]}
    >
      <View style={styles.queueCopy}>
        <Text style={styles.queueTitle}>{request.providerName}</Text>
        <Text style={styles.queueMeta}>Submitted {formatDate(request.submittedAt)}</Text>
        <Text style={styles.queuePreview} numberOfLines={2}>{request.evidenceSummary}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
    </Pressable>
  );
}

function ReportQueueCard({ report, onPress }: { report: ContentReport; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.queueCard, pressed && styles.pressed]}
    >
      <View style={styles.queueCopy}>
        <View style={styles.queueTitleRow}>
          <Text style={styles.queueTitle} numberOfLines={1}>{report.targetName}</Text>
          <Text
            style={[
              styles.statusBadge,
              report.status === 'reviewing' && styles.reviewingBadge,
              (report.status === 'resolved' || report.status === 'dismissed') && styles.closedBadge,
            ]}
          >
            {formatStatus(report.status)}
          </Text>
        </View>
        <Text style={styles.queueMeta}>{report.targetType === 'review' ? 'Review' : 'Service'} · {formatReason(report.reason)} · {formatDate(report.createdAt)}</Text>
        <Text style={styles.queuePreview} numberOfLines={2}>{report.details}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
    </Pressable>
  );
}

function AccessState({
  icon,
  title,
  message,
  action,
  onAction,
  loading,
}: {
  icon?: string;
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.accessState}>
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} />
      ) : (
        <View style={styles.accessIcon}>
          <Ionicons name={(icon ?? 'shield-outline') as never} size={34} color={Colors.primary} />
        </View>
      )}
      <Text style={styles.accessTitle}>{title}</Text>
      <Text style={styles.accessMessage}>{message}</Text>
      {action && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.accessButton, pressed && styles.pressed]}
        >
          <Text style={styles.accessButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
}

function formatReason(reason: string) {
  return reason.replace('_', ' ').replace(/^./, (value) => value.toUpperCase());
}

function formatStatus(status: string) {
  return status.replace(/^./, (value) => value.toUpperCase());
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primarySoft,
  },
  heroIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  heroCopy: { flex: 1, gap: Spacing.xs },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    minWidth: 0,
    flex: 1,
    alignItems: 'center',
    gap: 3,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  statValue: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  errorText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 20 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  section: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  sectionSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs },
  queueCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  queueCopy: { flex: 1, gap: 3 },
  queueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  queueTitle: { flexShrink: 1, color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  queueMeta: { color: Colors.primaryDark, fontSize: FontSize.xs, fontWeight: '700' },
  queuePreview: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radius.full,
    color: Colors.danger,
    backgroundColor: Colors.dangerSoft,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  reviewingBadge: { color: Colors.primaryDark, backgroundColor: Colors.primarySoft },
  closedBadge: { color: Colors.success, backgroundColor: Colors.successSoft },
  emptyText: { paddingVertical: Spacing.md, color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  auditNote: { color: Colors.textSubtle, fontSize: FontSize.xs, lineHeight: 18, textAlign: 'center' },
  accessState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  accessIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 34,
    backgroundColor: Colors.primarySoft,
  },
  accessTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  accessMessage: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  accessButton: {
    minHeight: 50,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  accessButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
