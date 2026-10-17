import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { type AppLocale, useLocalization } from '@/providers/LocalizationProvider';

// Each option is written in its own language so it stays recognizable either way.
const OPTIONS: readonly { locale: AppLocale; label: string }[] = [
  { locale: 'en', label: 'English' },
  { locale: 'ar', label: 'العربية' },
];

export default function LanguageToggle() {
  const { locale, setLocale, t } = useLocalization();

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('App language')} style={styles.group}>
      {OPTIONS.map((option) => {
        const selected = option.locale === locale;
        return (
          <Pressable
            key={option.locale}
            accessibilityRole="radio"
            aria-checked={selected}
            accessibilityState={{ checked: selected }}
            accessibilityLanguage={option.locale}
            onPress={() => setLocale(option.locale)}
            style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
          >
            <Text lang={option.locale} style={[styles.label, selected && styles.labelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
  },
  option: {
    minHeight: 44,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
  },
  optionSelected: { backgroundColor: Colors.primary },
  pressed: { opacity: 0.8 },
  label: { color: Colors.primaryDark, fontSize: FontSize.sm, fontWeight: '800' },
  labelSelected: { color: Colors.textOnPrimary },
});
