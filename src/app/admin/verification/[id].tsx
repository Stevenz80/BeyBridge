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
import VerificationDocumentList from '@/components/verification-document-list';
import { useTrust } from '@/providers/TrustProvider';

export default function VerificationReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    adminLoading,
    adminVerificationRequests,
    isAdmin,
    refreshTrustData,
    reviewVerification,
    trustLoading,
  } = useTrust();
  const [adminNote, setAdminNote] = useState('');
  const [busy, setBusy] = useState<'approved' | 'rejected' | null>(null);
  const request = adminVerificationRequests.find((item) => item.id === id);

  useFocusEffect(
    useCallback(() => {
      void refreshTrustData();
    }, [refreshTrustData])
  );

  if (adminLoading || trustLoading) {
    return <CenteredState loading title="Loading verification request" message="Retrieving the evidence and review history." />;
  }

  if (!isAdmin) {
    return (
      <CenteredState
        icon="shield-outline"
        title="Administrator access required"
        message="This review is restricted to platform administrators."
        action="Back to profile"
        onAction={() => router.replace('/profile')}
      />
    );
  }

  if (!request) {
    return (
      <CenteredState
        icon="alert-circle-outline"
        title="Request unavailable"
        message="This verification request was not found or is no longer visible."
        action="Back to dashboard"
        onAction={() => router.replace('/admin/index')}
      />
    );
  }

  const decide = (status: 'approved' | 'rejected') => {
    if (status === 'rejected' && adminNote.trim().length < 5) {
      Alert.alert('Add a clear reason', 'Explain why the evidence was rejected so the provider can improve a future submission.');
      return;
    }

    Alert.alert(
      status === 'approved' ? 'Approve provider verification?' : 'Reject provider verification?',
      status === 'approved'
        ? 'The verified badge will appear on this listing immediately.'
        : 'The provider will see your note and can submit a new request later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'approved' ? 'Approve' : 'Reject',
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(status);
            const result = await reviewVerification(request.id, status, adminNote);
            setBusy(null);
            if (result.error) {
              Alert.alert('Decision not saved', result.error);
              return;
            }
            Alert.alert('Decision recorded', `${request.providerName} was ${status}.`, [
              { text: 'Done', onPress: () => router.replace('/admin/index') },
            ]);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Stack.Screen options={{ title: 'Verification review' }} />

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="shield-checkmark-outline" size={30} color={Colors.primary} />
        </View>
        <Text style={styles.eyebrow}>PROVIDER VERIFICATION</Text>
        <Text style={styles.title}>{request.providerName}</Text>
        <Text style={styles.meta}>Submitted {formatDate(request.submittedAt)} · {formatStatus(request.status)}</Text>
      </View>

      <View style={styles.section}>
        <DetailRow label="Business registration" value={request.businessRegistration || 'Not provided'} />
        <DetailRow label="Professional licence" value={request.licenseNumber || 'Not provided'} />
        <View style={styles.divider} />
        <Text style={styles.label}>Evidence summary</Text>
        <Text style={styles.evidence}>{request.evidenceSummary}</Text>
      </View>

      <VerificationDocumentList request={request} />

      <View style={styles.guidance}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
        <Text style={styles.guidanceText}>
          Confirm the stated identity and records outside the app before approving. A badge means evidence was reviewed; it is not a service guarantee.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Decision note</Text>
        <TextInput
          multiline
          value={adminNote}
          onChangeText={setAdminNote}
          maxLength={1000}
          editable={!busy && request.status === 'pending'}
          placeholder="Record what you checked. A reason is required when rejecting."
          placeholderTextColor={Colors.textSubtle}
          style={styles.input}
        />
        <Text style={styles.helper}>{adminNote.trim().length}/1000</Text>
      </View>

      {request.status === 'pending' ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(busy)}
            onPress={() => decide('rejected')}
            style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            {busy === 'rejected' ? <ActivityIndicator color={Colors.danger} /> : <Text style={styles.rejectText}>Reject</Text>}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(busy)}
            onPress={() => decide('approved')}
            style={({ pressed }) => [styles.approveButton, pressed && styles.pressed, busy && styles.disabled]}
          >
            {busy === 'approved' ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={19} color={Colors.textOnPrimary} />
                <Text style={styles.approveText}>Approve</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.completedCard}>
          <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
          <Text style={styles.completedText}>This request was {request.status}. {request.adminNote || 'No decision note was recorded.'}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function CenteredState({
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
    <View style={styles.centered}>
      {loading ? <ActivityIndicator size="large" color={Colors.primary} /> : (
        <View style={styles.centeredIcon}><Ionicons name={(icon ?? 'shield-outline') as never} size={34} color={Colors.primary} /></View>
      )}
      <Text style={styles.centeredTitle}>{title}</Text>
      <Text style={styles.centeredMessage}>{message}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.centeredButton, pressed && styles.pressed]}>
          <Text style={styles.centeredButtonText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatStatus(status: string) {
  return status.replace(/^./, (value) => value.toUpperCase());
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  hero: { alignItems: 'center', gap: Spacing.xs, padding: Spacing.lg, borderRadius: Radius.xl, backgroundColor: Colors.primarySoft },
  heroIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 31, backgroundColor: Colors.surface },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
  meta: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center' },
  section: { gap: Spacing.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, backgroundColor: Colors.surface, ...Shadows.card },
  detailRow: { gap: 4 },
  label: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '800' },
  value: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  divider: { height: 1, backgroundColor: Colors.border },
  evidence: { color: Colors.text, fontSize: FontSize.sm, lineHeight: 22 },
  guidance: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  guidanceText: { flex: 1, color: Colors.primaryDark, fontSize: FontSize.xs, lineHeight: 18 },
  input: { minHeight: 130, padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.md, color: Colors.text, backgroundColor: Colors.background, fontSize: FontSize.sm, textAlignVertical: 'top' },
  helper: { color: Colors.textSubtle, fontSize: FontSize.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  rejectButton: { minHeight: 54, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.danger, borderRadius: Radius.md, backgroundColor: Colors.surface },
  rejectText: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '900' },
  approveButton: { minHeight: 54, flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.success },
  approveText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  completedCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.successSoft },
  completedText: { flex: 1, color: Colors.success, fontSize: FontSize.sm, lineHeight: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl, backgroundColor: Colors.background },
  centeredIcon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, backgroundColor: Colors.primarySoft },
  centeredTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900', textAlign: 'center' },
  centeredMessage: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  centeredButton: { minHeight: 50, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md, backgroundColor: Colors.primary },
  centeredButtonText: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});
