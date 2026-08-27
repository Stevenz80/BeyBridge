import { Host, Picker } from '@expo/ui';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { PriceSortDirection } from '@/lib/provider-pricing';
import { useLocalization } from '@/providers/LocalizationProvider';

type PriceSortPickerProps = {
  value: PriceSortDirection | null;
  onChange: (value: PriceSortDirection | null) => void;
  testID: string;
};

const DEFAULT_ORDER = 'default';

export default function PriceSortPicker({ value, onChange, testID }: PriceSortPickerProps) {
  const { t } = useLocalization();
  const selectedValue = value ?? DEFAULT_ORDER;

  return (
    <View style={[styles.control, value && styles.controlActive]} testID={`${testID}-control`}>
      <Ionicons
        name="pricetag-outline"
        size={16}
        color={value ? Colors.primary : Colors.primaryDark}
      />
      <Host
        matchContents
        seedColor={Colors.primary}
        style={styles.pickerHost}
      >
        <Picker
          selectedValue={selectedValue}
          onValueChange={(nextValue) =>
            onChange(nextValue === DEFAULT_ORDER ? null : (nextValue as PriceSortDirection))
          }
          testID={testID}
        >
          <Picker.Item label={t('Sort by price')} value={DEFAULT_ORDER} />
          <Picker.Item label={t('Price: low to high')} value="ascending" />
          <Picker.Item label={t('Price: high to low')} value="descending" />
        </Picker>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
  },
  controlActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  pickerHost: { minWidth: 152, minHeight: 40 },
});
