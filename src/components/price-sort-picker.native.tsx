import { useMemo } from 'react';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';

import { FilterChipVisual } from '@/components/filter-chip';
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
  const label = value === 'ascending'
    ? t('Price: low to high')
    : value === 'descending'
      ? t('Price: high to low')
      : t('Sort by price');

  const actions = useMemo<MenuAction[]>(
    () => [
      {
        id: DEFAULT_ORDER,
        title: t('Default order'),
        state: value === null ? 'on' : 'off',
      },
      {
        id: 'ascending',
        title: t('Low to high'),
        state: value === 'ascending' ? 'on' : 'off',
      },
      {
        id: 'descending',
        title: t('High to low'),
        state: value === 'descending' ? 'on' : 'off',
      },
    ],
    [t, value]
  );

  return (
    <MenuView
      actions={actions}
      onPressAction={({ nativeEvent }) => {
        const nextValue = nativeEvent.event;
        onChange(
          nextValue === DEFAULT_ORDER ? null : (nextValue as PriceSortDirection)
        );
      }}
      testID={testID}
      title={t('Sort by price')}
    >
      <FilterChipVisual
        accessible
        accessibilityLabel={label}
        icon="pricetag-outline"
        label={label}
        selected={value !== null}
        trailingIcon="chevron-down"
      />
    </MenuView>
  );
}
