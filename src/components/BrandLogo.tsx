import { Image, ImageStyle, StyleProp } from 'react-native';

type BrandLogoProps = {
  width?: number;
  style?: StyleProp<ImageStyle>;
};

// The transparent artwork sits cleanly on every app surface; the old white JPG
// showed as an off-white box on the gray screen background.
const LOGO = require('../../assets/branding/beybridge-logo-transparent.png');

export default function BrandLogo({ width = 214, style }: BrandLogoProps) {
  return (
    <Image
      source={LOGO}
      resizeMode="contain"
      accessibilityLabel="BeyBridge — Explore Beirut, one service at a time"
      style={[{ width, height: width / 4.77 }, style]}
    />
  );
}
