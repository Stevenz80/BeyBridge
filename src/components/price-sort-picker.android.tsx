import { Alert } from 'react-native';

import FilterChip from '@/components/filter-chip';
import type { PriceSortDirection } from '@/lib/provider-pricing';
import { useLocalization } from '@/providers/LocalizationProvider';

type PriceSortPickerProps = {
  value: PriceSortDirection | null;
  onChange: (value: PriceSortDirection | null) => void;
  testID: string;
};

// @expo/ui's Android MenuView measures its React Native trigger as zero-width
// inside a horizontal ScrollView, which hid this control entirely. A plain chip
// with a native three-option dialog keeps the same choices.
export default function PriceSortPicker({ value, onChange, testID }: PriceSortPickerProps) {
  const { t } = useLocalization();
  const label = value === 'ascending'
    ? t('Price: low to high')
    : value === 'descending'
      ? t('Price: high to low')
      : t('Sort by price');

  const choose = () => {
    // Android stacks three dialog buttons bottom-up, so this reads
    // Default order, Low to high, High to low from the top.
    Alert.alert(t('Sort by price'), undefined, [
      { text: t('High to low'), onPress: () => onChange('descending') },
      { text: t('Low to high'), onPress: () => onChange('ascending') },
      { text: t('Default order'), onPress: () => onChange(null) },
    ], { cancelable: true });
  };

  return (
    <FilterChip
      label={label}
      icon="pricetag-outline"
      trailingIcon="chevron-down"
      selected={value !== null}
      onPress={choose}
      testID={testID}
    />
  );
}
