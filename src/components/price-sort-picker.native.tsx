import { useState } from 'react';

import FilterChip from '@/components/filter-chip';
import OptionSheet from '@/components/option-sheet';
import type { PriceSortDirection } from '@/lib/provider-pricing';

type PriceSortPickerProps = {
  value: PriceSortDirection | null;
  onChange: (value: PriceSortDirection | null) => void;
  testID: string;
};

// The app's own sheet keeps this consistent on iOS and Android. (@expo/ui's
// Android MenuView also measured this chip as zero-width in a horizontal row.)
export default function PriceSortPicker({ value, onChange, testID }: PriceSortPickerProps) {
  const [open, setOpen] = useState(false);
  const label = value === 'ascending'
    ? 'Price: low to high'
    : value === 'descending'
      ? 'Price: high to low'
      : 'Sort by price';

  return (
    <>
      <FilterChip
        label={label}
        icon="pricetag-outline"
        trailingIcon="chevron-down"
        selected={value !== null}
        onPress={() => setOpen(true)}
        testID={testID}
      />
      {open ? (
        <OptionSheet
          visible
          title="Sort by price"
          subtitle="Services without a listed price appear last."
          onClose={() => setOpen(false)}
          options={[
            { key: 'default', label: 'Default order', icon: 'swap-vertical-outline',
              selected: value === null, onPress: () => onChange(null) },
            { key: 'ascending', label: 'Low to high', icon: 'trending-up-outline',
              selected: value === 'ascending', onPress: () => onChange('ascending') },
            { key: 'descending', label: 'High to low', icon: 'trending-down-outline',
              selected: value === 'descending', onPress: () => onChange('descending') },
          ]}
        />
      ) : null}
    </>
  );
}
