import React from 'react';
import { TextInput as NativeTextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useLocalization } from '@/providers/LocalizationProvider';

export default function TextInput({
  accessibilityLabel,
  placeholder,
  style,
  ...props
}: TextInputProps) {
  const { isRTL, t } = useLocalization();
  return (
    <NativeTextInput
      {...props}
      accessibilityLabel={
        typeof accessibilityLabel === 'string' ? t(accessibilityLabel) : accessibilityLabel
      }
      placeholder={placeholder ? t(placeholder) : placeholder}
      style={[{ textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }, style]}
    />
  );
}
