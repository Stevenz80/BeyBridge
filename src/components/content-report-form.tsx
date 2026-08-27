import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import TextInput from '@/components/localized-text-input';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import KeyboardAwareScrollView from '@/components/keyboard-aware-scroll-view';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { ContentReportInput, ReportReason } from '@/lib/types';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'misleading', label: 'Misleading information' },
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Abusive content' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'fraud', label: 'Suspected fraud' },
  { value: 'other', label: 'Something else' },
];

type Props = {
  targetLabel: string;
  targetType: 'provider' | 'review';
  providerId: string;
  reviewId: string | null;
  busy: boolean;
  onSubmit: (input: ContentReportInput) => Promise<string | null>;
};

export default function ContentReportForm({
  targetLabel,
  targetType,
  providerId,
  reviewId,
  busy,
  onSubmit,
}: Props) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const canSubmit = Boolean(reason) && details.trim().length >= 10 && !busy;

  const submit = async () => {
    if (!reason) {
      setFeedback('Choose the reason that best describes the problem.');
      return;
    }
    if (details.trim().length < 10) {
      setFeedback('Add at least 10 characters so the administrator can investigate.');
      return;
    }

    setFeedback(null);
    const error = await onSubmit({ targetType, providerId, reviewId, reason, details });
    if (error) setFeedback(error);
  };

  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="flag-outline" size={29} color={Colors.danger} />
          </View>
          <Text style={styles.eyebrow}>TRUST & SAFETY</Text>
          <Text style={styles.title}>Report {targetType === 'review' ? 'this review' : 'this service'}</Text>
          <Text style={styles.target} numberOfLines={2}>
            {targetLabel}
          </Text>
          <Text style={styles.subtitle}>
            Your report is private. The person or business you report will not see your identity.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What is the problem?</Text>
          <View style={styles.reasonGrid}>
            {REASONS.map((item) => {
              const selected = reason === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setReason(item.value)}
                  style={({ pressed }) => [
                    styles.reasonButton,
                    selected && styles.reasonButtonSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selected ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>What happened?</Text>
            <TextInput
              multiline
              value={details}
              onChangeText={setDetails}
              maxLength={1500}
              placeholder="Describe the issue and include the facts an administrator should check. Do not include passwords or payment-card details."
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
            <Text style={styles.helper}>{details.trim().length}/1500 · minimum 10 characters</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
          <Text style={styles.noticeText}>
            Reporting does not automatically remove content. An administrator reviews the context
            and records the outcome.
          </Text>
        </View>

        {feedback ? (
          <View style={styles.feedback}>
            <Ionicons name="alert-circle-outline" size={19} color={Colors.danger} />
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons name="flag" size={18} color={Colors.textOnPrimary} />
              <Text style={styles.submitText}>Submit private report</Text>
            </>
          )}
        </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  content: { gap: Spacing.md, padding: Spacing.md, paddingBottom: Spacing.xxl },
  hero: {
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.dangerSoft,
  },
  heroIcon: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderRadius: 30,
    backgroundColor: Colors.surface,
  },
  eyebrow: { color: Colors.danger, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
  target: { color: Colors.danger, fontSize: FontSize.sm, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  section: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  sectionTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '900' },
  reasonGrid: { gap: Spacing.sm },
  reasonButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  reasonButtonSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  reasonText: { flex: 1, color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700' },
  reasonTextSelected: { color: Colors.primaryDark },
  field: { gap: 7 },
  label: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  input: {
    minHeight: 150,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    color: Colors.text,
    backgroundColor: Colors.background,
    fontSize: FontSize.sm,
    textAlignVertical: 'top',
  },
  helper: { color: Colors.textMuted, fontSize: FontSize.xs },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  noticeText: { flex: 1, color: Colors.primaryDark, fontSize: FontSize.xs, lineHeight: 18 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  feedbackText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 20 },
  submitButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.danger,
  },
  submitText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
