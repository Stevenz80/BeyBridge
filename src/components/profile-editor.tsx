import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import TextInput from '@/components/localized-text-input';
import Text from '@/components/localized-text';
import { Ionicons } from '@expo/vector-icons';
import KeyboardAwareScrollView from '@/components/keyboard-aware-scroll-view';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import type { ProfileUpdate, UserProfile } from '@/lib/types';

type MutationResult = { error: string | null };

export default function ProfileEditor({
  visible,
  profile,
  fallbackName,
  onClose,
  onSave,
}: {
  visible: boolean;
  profile: UserProfile | null;
  fallbackName: string;
  onClose: () => void;
  onSave: (updates: ProfileUpdate) => Promise<MutationResult>;
}) {
  const [fullName, setFullName] = useState(profile?.fullName || fallbackName);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [defaultArea, setDefaultArea] = useState(profile?.defaultArea ?? '');
  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'ar'>(
    profile?.preferredLanguage ?? 'en'
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = async () => {
    if (fullName.trim().length < 2) {
      setFeedback('Enter at least two characters for your name.');
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    const result = await onSave({
      fullName: fullName.trim(),
      phone: phone.trim(),
      defaultArea: defaultArea.trim(),
      preferredLanguage,
      accountType: profile?.accountType ?? 'customer',
    });
    setSubmitting(false);

    if (result.error) setFeedback(result.error);
    else onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Edit profile</Text>
            <Text style={styles.subtitle}>Make BeyBridge feel more personal</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close profile editor"
            hitSlop={8}
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={24} color={Colors.text} />
          </Pressable>
        </View>

        <KeyboardAwareScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <ProfileField
            label="Full name"
            icon="person-outline"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            autoComplete="name"
            textContentType="name"
          />
          <ProfileField
            label="Phone number"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            placeholder="+961…"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          <ProfileField
            label="Default area"
            icon="location-outline"
            value={defaultArea}
            onChangeText={setDefaultArea}
            placeholder="Hamra, Achrafieh, Verdun…"
            autoCapitalize="words"
          />

          <ChoiceGroup
            label="Preferred language"
            options={[
              { value: 'en', label: 'English' },
              { value: 'ar', label: 'العربية' },
            ]}
            value={preferredLanguage}
            onChange={(value) => setPreferredLanguage(value as 'en' | 'ar')}
          />

          {feedback && (
            <View style={styles.feedback}>
              <Ionicons name="alert-circle-outline" size={19} color={Colors.danger} />
              <Text selectable style={styles.feedbackText}>{feedback}</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
            disabled={submitting}
            onPress={submit}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
              submitting && styles.disabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark" size={21} color={Colors.textOnPrimary} />
                <Text style={styles.saveLabel}>Save profile</Text>
              </>
            )}
          </Pressable>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

function ProfileField({
  label,
  icon,
  ...inputProps
}: React.ComponentProps<typeof TextInput> & { label: string; icon: string }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <Ionicons name={icon as never} size={20} color={Colors.primary} />
        <TextInput
          {...inputProps}
          style={styles.input}
          placeholderTextColor={Colors.textSubtle}
          selectionColor={Colors.primary}
        />
      </View>
    </View>
  );
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerText: { flex: 1, gap: 2 },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
  },
  content: { gap: Spacing.lg, padding: Spacing.md, paddingBottom: Spacing.xl },
  fieldGroup: { gap: Spacing.sm },
  fieldLabel: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '800' },
  inputWrap: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  input: { flex: 1, color: Colors.text, fontSize: FontSize.sm },
  choiceRow: { flexDirection: 'row', gap: Spacing.sm },
  choice: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  choiceSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  choiceLabel: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center' },
  choiceLabelSelected: { color: Colors.primaryDark, fontWeight: '900' },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  feedbackText: { flex: 1, color: Colors.danger, fontSize: FontSize.sm, lineHeight: 20 },
  saveButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  saveButtonPressed: { backgroundColor: Colors.primaryPressed },
  saveLabel: { color: Colors.textOnPrimary, fontSize: FontSize.sm, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
