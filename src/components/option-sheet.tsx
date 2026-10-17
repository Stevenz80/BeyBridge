import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/localized-text';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { useLocalization } from '@/providers/LocalizationProvider';

export type SheetOption = {
  key: string;
  label: string;
  description?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  selected?: boolean;
  onPress: () => void;
};

type OptionSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: readonly SheetOption[];
  onClose: () => void;
};

// App-styled replacement for native alert dialogs when the user picks one of a
// few actions. A Modal is its own root, so it re-applies the app's text direction.
export default function OptionSheet({ visible, title, subtitle, options, onClose }: OptionSheetProps) {
  const insets = useSafeAreaInsets();
  const { direction, t } = useLocalization();

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent
      navigationBarTranslucent onRequestClose={onClose}>
      <View style={[styles.root, { direction }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Close')} onPress={onClose}
          style={styles.backdrop} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.md }]}>
          <View style={styles.handle} />
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.options}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={t(option.label)}
                accessibilityState={{ selected: Boolean(option.selected) }}
                onPress={() => {
                  onClose();
                  option.onPress();
                }}
                style={({ pressed }) => [styles.option, option.selected && styles.optionSelected,
                  pressed && styles.pressed]}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={option.icon} size={21} color={Colors.primary} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  {option.description ? <Text style={styles.optionDescription}>{option.description}</Text> : null}
                </View>
                {option.selected ? <Ionicons name="checkmark-circle" size={22} color={Colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17, 17, 17, 0.4)' },
  sheet: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
  },
  heading: { gap: 2, paddingHorizontal: Spacing.xs },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '900' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm },
  options: { gap: Spacing.sm },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  optionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: Colors.primarySoft,
  },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: { color: Colors.text, fontSize: FontSize.md, fontWeight: '800' },
  optionDescription: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 17 },
  cancel: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  cancelLabel: { color: Colors.primaryDark, fontSize: FontSize.md, fontWeight: '900' },
  pressed: { opacity: 0.75 },
});
