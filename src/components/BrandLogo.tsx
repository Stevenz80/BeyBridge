import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

type BrandLogoProps = {
  variant?: 'transparent' | 'white';
  width?: number;
  style?: StyleProp<ImageStyle>;
};

const LOGOS = {
  transparent: require('../../assets/branding/beybridge-logo-transparent.png'),
  white: require('../../assets/branding/beybridge-logo-white.jpg'),
};

export default function BrandLogo({
  variant = 'transparent',
  width = 214,
  style,
}: BrandLogoProps) {
  return (
    <Image
      source={LOGOS[variant]}
      resizeMode="contain"
      accessibilityLabel="BeyBridge — Explore Beirut, one service at a time"
      style={[{ width, height: width / 4.77 }, style]}
    />
  );
}
