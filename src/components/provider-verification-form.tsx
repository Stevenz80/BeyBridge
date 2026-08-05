import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import type { Provider, VerificationRequestInput } from '@/lib/types';

type Props = {
  provider: Provider;
  busy: boolean;
  onSubmit: (input: VerificationRequestInput) => Promise<string | null>;
};

export default function ProviderVerificationForm({ provider, busy, onSubmit }: Props) {
  const [businessRegistration, setBusinessRegistration] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = async () => {
    if (evidenceSummary.trim().length < 30) {
      setFeedback('Explain your identity, experience, and verification evidence in at least 30 characters.');
      return;
    }

    setFeedback(null);
    const error = await onSubmit({
      providerId: provider.id,
      businessRegistration: businessRegistration.trim(),
      licenseNumber: licenseNumber.trim(),
      evidenceSummary: evidenceSummary.trim(),
    });
    if (error) setFeedback(error);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.eyebrow}>TRUST & SAFETY</Text>
          <Text style={styles.title}>Verify {provider.name}</Text>
          <Text style={styles.subtitle}>
            Verification tells customers that BeyBridge reviewed the identity and evidence behind
            this listing. Approval is not automatic.
          </Text>
        </View>

        <View style={styles.section}>
          <Field
            label="Business registration (optional)"
            value={businessRegistration}
            onChangeText={setBusinessRegistration}
            placeholder="Registration name or number"
            maxLength={200}
          />
          <Field
            label="Professional licence (optional)"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholder="Licence, syndicate, or certification number"
            maxLength={200}
          />
          <Field
            label="Verification evidence"
            value={evidenceSummary}
            onChangeText={setEvidenceSummary}
            placeholder="Explain who you are, your relevant experience, which records an administrator can verify, and how customers can confirm your business identity."
            maxLength={2000}
            multiline
          />
          <Text style={styles.helper}>{evidenceSummary.trim().length}/2000 · minimum 30 characters</Text>
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={21} color={Colors.primary} />
          <Text style={styles.noticeText}>
            Document uploads are the next security milestone. For now, provide only references an
            administrator can verify—never include passwords, bank details, or national-ID images.
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
          accessibilityState={{ busy, disabled: busy || evidenceSummary.trim().length < 30 }}
          disabled={busy || evidenceSummary.trim().length < 30}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submitButton,
            evidenceSummary.trim().length < 30 && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <>
              <Text style={styles.submitText}>Submit for review</Text>
              <Ionicons name="arrow-forward" size={19} color={Colors.textOnPrimary} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={Colors.textSubtle}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
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
    backgroundColor: Colors.primarySoft,
  },
  heroIcon: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderRadius: 31,
    backgroundColor: Colors.surface,
  },
  eyebrow: { color: Colors.primaryDark, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900', textAlign: 'center' },
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
  field: { gap: 7 },
  label: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    color: Colors.text,
    backgroundColor: Colors.background,
    fontSize: FontSize.sm,
  },
  multiline: { minHeight: 150, textAlignVertical: 'top' },
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
    backgroundColor: Colors.primary,
  },
  submitText: { color: Colors.textOnPrimary, fontSize: FontSize.md, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
});
