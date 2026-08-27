import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import Text from '@/components/localized-text';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

type FilterChipTone = 'soft' | 'strong';

type FilterChipVisualProps = {
  label: string;
  selected?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  trailingIcon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  tone?: FilterChipTone;
  accessible?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function FilterChipVisual({
  label,
  selected = false,
  icon,
  trailingIcon,
  loading = false,
  tone = 'soft',
  accessible = false,
  accessibilityLabel,
  style,
}: FilterChipVisualProps) {
  const strong = selected && tone === 'strong';
  const foreground = strong ? Colors.textOnPrimary : selected ? Colors.primaryDark : Colors.text;

  return (
    <View
      accessible={accessible}
      accessibilityRole={accessible ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessible ? { selected, busy: loading } : undefined}
      style={[
        styles.chip,
        selected && styles.chipSelected,
        strong && styles.chipSelectedStrong,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : icon ? (
        <Ionicons name={icon} size={16} color={foreground} />
      ) : null}
      <Text numberOfLines={1} style={[styles.label, { color: foreground }]}>
        {label}
      </Text>
      {trailingIcon ? <Ionicons name={trailingIcon} size={14} color={foreground} /> : null}
    </View>
  );
}

type FilterChipProps = Omit<FilterChipVisualProps, 'accessible' | 'accessibilityLabel'> & {
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export default function FilterChip({
  label,
  selected = false,
  loading = false,
  disabled = false,
  onPress,
  testID,
  style,
  ...visualProps
}: FilterChipProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed, isDisabled && styles.disabled]}
    >
      <FilterChipVisual
        {...visualProps}
        label={label}
        selected={selected}
        loading={loading}
        style={style}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: Radius.full },
  chip: {
    minHeight: Platform.select({ android: 48, default: 44 }),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm - 2,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  chipSelectedStrong: {
    backgroundColor: Colors.primary,
  },
  label: {
    flexShrink: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '800',
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});
