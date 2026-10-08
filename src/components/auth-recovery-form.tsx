import { ActivityIndicator, Pressable, StyleSheet, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardAwareScrollView from '@/components/keyboard-aware-scroll-view';
import Text from '@/components/localized-text';
import TextInput from '@/components/localized-text-input';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { useLocalization } from '@/providers/LocalizationProvider';

export function RecoveryLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </KeyboardAwareScrollView>
  );
}

export function RecoveryField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} autoCapitalize="none" autoCorrect={false}
        placeholderTextColor={Colors.textSubtle} selectionColor={Colors.primary} style={styles.input} />
    </View>
  );
}

export function RecoveryButton({ label, onPress, busy = false, disabled = false, secondary = false }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; secondary?: boolean;
}) {
  const { t } = useLocalization();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t(label)}
      accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary,
        (disabled || busy) && styles.disabled, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={secondary ? Colors.primary : Colors.textOnPrimary} /> :
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>}
    </Pressable>
  );
}

export function RecoveryFeedback({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.feedback, error && styles.error]}>
      <Text selectable style={[styles.copy, error && styles.errorText]}>{message}</Text>
    </View>
  );
}

export const recoveryStyles = StyleSheet.create({
  copy: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 22 },
  email: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
});

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: Spacing.md, alignItems: 'center', backgroundColor: Colors.background },
  card: { width: '100%', maxWidth: 480, padding: Spacing.lg, gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  title: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '900' },
  field: { gap: Spacing.sm },
  label: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  input: { minHeight: 54, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: Radius.md,
    padding: Spacing.md, color: Colors.text, fontSize: FontSize.md, backgroundColor: Colors.background },
  button: { minHeight: 52, justifyContent: 'center', alignItems: 'center', padding: Spacing.md,
    borderRadius: Radius.md, backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.primarySoft },
  buttonText: { color: Colors.textOnPrimary, fontWeight: '800', fontSize: FontSize.sm, textAlign: 'center' },
  secondaryText: { color: Colors.primaryDark },
  feedback: { padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primarySoft },
  error: { backgroundColor: Colors.dangerSoft },
  copy: { color: Colors.textMuted, fontSize: FontSize.sm, lineHeight: 22 },
  errorText: { color: Colors.danger },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});
