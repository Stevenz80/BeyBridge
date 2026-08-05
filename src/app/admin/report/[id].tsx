import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { ReportStatus } from '@/lib/types';
import { useTrust } from '@/providers/TrustProvider';

type BusyAction = 'reviewing' | 'resolved' | 'dismissed' | 'suspend' | 'restore' | null;

export default function ReportReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    adminLoading,
    adminReports,
    isAdmin,
    moderateProvider,
    moderationActions,
    refreshTrustData,
    trustLoading,
    updateReportStatus,
  } = useTrust();
  const [adminNote, setAdminNote] = useState('');
  const [moderationReason, setModerationReason] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const report = adminReports.find((item) => item.id === id);
  const latestModeration = report
    ? moderationActions.find((action) => action.providerId === report.providerId)
    : undefined;
  const providerSuspended = latestModeration?.action === 'suspend';

  useFocusEffect(
    useCallback(() => {
      void refreshTrustData();
    }, [refreshTrustData])
  );

  if (adminLoading || trustLoading) {
    return <CenteredState loading title="Loading report" message="Retrieving the report and moderation history." />;
  }

  if (!isAdmin) {
    return (
      <CenteredState
        icon="shield-outline"
        title="Administrator access required"
        message="This report is restricted to platform administrators."
        action="Back to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (!report) {
    return (
      <CenteredState
        icon="alert-circle-outline"
        title="Report unavailable"
        message="This report was not found or is no longer visible."
        action="Back to dashboard"
        onAction={() => router.replace('/admin')}
      />
    );
  }

  const changeStatus = (status: Exclude<ReportStatus, 'open'>) => {
    const labels = {
      reviewing: ['Start reviewing?', 'The report will stay open while you investigate.'],
      resolved: ['Resolve this report?', 'Use the note to record what was checked and which action was taken.'],
      dismissed: ['Dismiss this report?', 'Use the note to explain why no moderation action was needed.'],
    } as const;
    if (status !== 'reviewing' && adminNote.trim().length < 5) {
      Alert.alert('Add an outcome note', 'Record at least five characters before closing the report.');
      return;
    }
    const [title, message] = labels[status];
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: status === 'dismissed' ? 'Dismiss' : status === 'resolved' ? 'Resolve' : 'Start review',
        style: status === 'dismissed' ? 'destructive' : 'default',
        onPress: async () => {
          setBusy(status);
          const result = await updateReportStatus(report.id, status, adminNote);
          setBusy(null);
          if (result.error) {
            Alert.alert('Report not updated', result.error);
            return;
          }
          if (status === 'reviewing') {
            Alert.alert('Review started', 'The report remains in the active queue.');
          } else {
            Alert.alert('Outcome recorded', `The report was ${status}.`, [
              { text: 'Done', onPress: () => router.replace('/admin') },
            ]);
          }
        },
      },
    ]);
  };

  const moderate = (action: 'suspend' | 'restore') => {
    if (moderationReason.trim().length < 10) {
      Alert.alert('Add a moderation reason', 'Record at least 10 characters for the audit trail.');
      return;
    }
    Alert.alert(
      action === 'suspend' ? 'Suspend this service listing?' : 'Restore this service listing?',
      action === 'suspend'
        ? 'The listing will be paused and removed from public discovery immediately.'
        : 'The moderation restriction will be lifted. The provider can publish the listing again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'suspend' ? 'Suspend' : 'Restore',
          style: action === 'suspend' ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(action);
            const result = await moderateProvider(report.providerId, action, moderationReason);
            setBusy(null);
            if (result.error) {
              Alert.alert('Moderation action failed', result.error);
              return;
            }
            Alert.alert(
              action === 'suspend' ? 'Listing suspended' : 'Listing restored',
              'The action was saved to the moderation history.'
            );
          },
        },
      ]
    );
  };

  const active = report.status === 'open' || report.status === 'reviewing';

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Report review' }} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="flag" size={28} color={Colors.danger} />
        </View>
        <Text style={styles.eyebrow}>CONTENT REPORT</Text>
        <Text style={styles.title}>{report.targetName}</Text>
        <View style={styles.heroMetaRow}>
          <Text style={styles.statusBadge}>{formatStatus(report.status)}</Text>
          <Text style={styles.meta}>{formatDate(report.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <DetailRow label="Reported content" value={report.targetType === 'review' ? 'Customer review' : 'Service listing'} />
        <DetailRow label="Reason" value={formatReason(report.reason)} />
        <DetailRow label="Submitted by" value={report.reporterName} />
        <View style={styles.divider} />
        <Text style={styles.label}>Reporter details</Text>
        <Text style={styles.body}>{report.details}</Text>
        {report.targetSnapshot ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.label}>Content snapshot at reporting time</Text>
            <Text style={styles.snapshot}>{report.targetSnapshot}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Investigation outcome</Text>
        </View>
        <TextInput
          multiline
          value={adminNote}
          onChangeText={setAdminNote}
          maxLength={1000}
          editable={!busy && active}
          placeholder="Record what you checked, your decision, and any follow-up needed."
          placeholderTextColor={Colors.textSubtle}
          style={styles.input}
        />
        <Text style={styles.helper}>{adminNote.trim().length}/1000</Text>
        {report.status === 'open' ? (
          <ActionButton
            label="Mark as reviewing"
            icon="eye-outline"
            busy={busy === 'reviewing'}
            disabled={Boolean(busy)}
            onPress={() => changeStatus('reviewing')}
          />
        ) : null}
        {active ? (
          <View style={styles.splitActions}>
            <OutlineAction
              label="Dismiss"
              danger
              busy={busy === 'dismissed'}
              disabled={Boolean(busy)}
              onPress={() => changeStatus('dismissed')}
            />
            <OutlineAction
              label="Resolve"
              busy={busy === 'resolved'}
              disabled={Boolean(busy)}
              onPress={() => changeStatus('resolved')}
            />
          </View>
        ) : (
          <View style={styles.completedCard}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
            <Text style={styles.completedText}>{report.adminNote || `This report was ${report.status}.`}</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="pause-circle-outline" size={20} color={Colors.danger} />
          <Text style={styles.sectionTitle}>Provider listing moderation</Text>
        </View>
        <Text style={styles.moderationState}>
          Current restriction: {providerSuspended ? 'Suspended' : 'Active'}
        </Text>
        {latestModeration ? (
          <Text style={styles.latestAction}>Latest action {formatDate(latestModeration.createdAt)}: {latestModeration.reason}</Text>
        ) : null}
        <TextInput
          multiline
          value={moderationReason}
          onChangeText={setModerationReason}
          maxLength={1000}
          editable={!busy}
          placeholder={providerSuspended ? 'Why is it safe to restore this listing?' : 'Why should this listing be suspended?'}
          placeholderTextColor={Colors.textSubtle}
          style={[styles.input, styles.moderationInput]}
        />
        <Text style={styles.helper}>{moderationReason.trim().length}/1000 · minimum 10 characters</Text>
        <Pressable
          accessibilityRole="button"
          disabled={Boolean(busy)}
          onPress={() => moderate(providerSuspended ? 'restore' : 'suspend')}
          style={({ pressed }) => [
            providerSuspended ? styles.restoreButton : styles.suspendButton,
            pressed && styles.pressed,
            busy && styles.disabled,
          ]}
        >
          {busy === 'suspend' || busy === 'restore' ? (
            <ActivityIndicator color={providerSuspended ? Colors.textOnPrimary : Colors.danger} />
          ) : (
            <>
              <Ionicons
                name={providerSuspended ? 'play-circle-outline' : 'pause-circle-outline'}
                size={19}
                color={providerSuspended ? Colors.textOnPrimary : Colors.danger}
              />
              <Text style={providerSuspended ? styles.restoreText : styles.suspendText}>
                {providerSuspended ? 'Restore listing' : 'Suspend listing'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}

function ActionButton({ label, icon, busy, disabled, onPress }: { label: string; icon: string; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, disabled && styles.disabled]}>
      {busy ? <ActivityIndicator color={Colors.textOnPrimary} /> : <><Ionicons name={icon as never} size={19} color={Colors.textOnPrimary} /><Text style={styles.primaryButtonText}>{label}</Text></>}
    </Pressable>
  );
}

function OutlineAction({ label, danger, busy, disabled, onPress }: { label: string; danger?: boolean; busy: boolean; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.outlineButton, danger && styles.dangerOutline, pressed && styles.pressed, disabled && styles.disabled]}>
      {busy ? <ActivityIndicator color={danger ? Colors.danger : Colors.primary} /> : <Text style={[styles.outlineText, danger && styles.dangerText]}>{label}</Text>}
    </Pressable>
  );
}

function CenteredState({ icon, title, message, action, onAction, loading }: { icon?: string; title: string; message: string; action?: string; onAction?: () => void; loading?: boolean }) {
  return (
    <View style={styles.centered}>
      {loading ? <ActivityIndicator size="large" color={Colors.primary} /> : <View style={styles.centeredIcon}><Ionicons name={(icon ?? 'flag-outline') as never} size={34} color={Colors.primary} /></View>}
      <Text style={styles.centeredTitle}>{title}</Text>
      <Text style={styles.centeredMessage}>{message}</Text>
      {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.centeredButton, pressed && styles.pressed]}><Text style={styles.centeredButtonText}>{action}</Text></Pressable> : null}
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function formatStatus(value: string) { return value.replace(/^./, (letter) => letter.toUpperCase()); }
function formatReason(value: string) { return value.replace('_', ' ').replace(/^./, (letter) => letter.toUpperCase()); }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  hero: { alignItems: 'center', gap: Spacing.xs, padding: Spacing.lg, borderRadius: Radius.xl, backgroundColor: Colors.dangerSoft },
  heroIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: 30, backgroundColor: Colors.surface },
  eyebrow: { color: Colors.danger, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, color: Colors.danger, backgroundColor: Colors.surface, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs },
  section: { gap: Spacing.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, backgroundColor: Colors.surface, ...Shadows.card },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  detailRow: { gap: 4 },
  label: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '800' },
  value: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.border },
  body: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 22 },
  snapshot: { padding: Spacing.sm, borderRadius: Radius.sm, color: Colors.textMuted, backgroundColor: Colors.background, fontSize: FontSize.xs, lineHeight: 18 },
  input: { minHeight: 125, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.md, color: Colors.text, backgroundColor: Colors.background, fontSize: FontSize.sm, textAlignVertical: 'top' },
  moderationInput: { minHeight: 100 },
  helper: { color: Colors.textSubtle, fontSize: FontSize.xs },
  primaryButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.primary },
  primaryButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  splitActions: { flexDirection: 'row', gap: Spacing.sm },
  outlineButton: { minHeight: 50, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, backgroundColor: Colors.surface },
  outlineText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '900' },
  dangerOutline: { borderColor: Colors.danger },
  dangerText: { color: Colors.danger },
  completedCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.successSoft },
  completedText: { flex: 1, color: Colors.success, fontSize: FontSize.sm, lineHeight: 20 },
  moderationState: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '900' },
  latestAction: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18 },
  suspendButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderWidth: 1, borderColor: Colors.danger, borderRadius: Radius.md, backgroundColor: Colors.surface },
  suspendText: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '900' },
  restoreButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.success },
  restoreText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl, backgroundColor: Colors.background },
  centeredIcon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, backgroundColor: Colors.primarySoft },
  centeredTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  centeredMessage: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  centeredButton: { minHeight: 50, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, backgroundColor: Colors.primary },
  centeredButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
