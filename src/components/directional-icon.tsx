import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useLocalization } from '@/providers/LocalizationProvider';

const MIRRORED: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  'chevron-forward': 'chevron-back',
  'chevron-back': 'chevron-forward',
  'arrow-forward': 'arrow-back',
  'arrow-back': 'arrow-forward',
};

// Forward/back arrows follow reading direction: the layout mirrors in Arabic,
// so a right-pointing "forward" chevron would point backwards.
export default function DirectionalIcon({ name, ...props }: ComponentProps<typeof Ionicons>) {
  const { isRTL } = useLocalization();
  return <Ionicons {...props} name={isRTL ? MIRRORED[name] ?? name : name} />;
}
