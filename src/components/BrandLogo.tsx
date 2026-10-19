import { Image, ImageStyle, StyleProp } from 'react-native';
import { useLocalization } from '@/providers/LocalizationProvider';

type BrandLogoProps = {
  width?: number;
  style?: StyleProp<ImageStyle>;
};

// The transparent artwork sits cleanly on every app surface; the old white JPG
// showed as an off-white box on the gray screen background.
const LOGO = require('../../assets/branding/beybridge-logo-transparent.png');

export default function BrandLogo({ width = 214, style }: BrandLogoProps) {
  const { t } = useLocalization();
  return (
    <Image
      source={LOGO}
      resizeMode="contain"
      accessibilityLabel={t('BeyBridge — Explore Beirut, one service at a time')}
      style={[{ width, height: width / 4.77 }, style]}
    />
  );
}
