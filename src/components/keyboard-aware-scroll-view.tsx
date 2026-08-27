import React from 'react';
import { Platform, type ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView as ControllerKeyboardAwareScrollView } from 'react-native-keyboard-controller';

export default function KeyboardAwareScrollView({
  children,
  bottomOffset = 96,
  keyboardDismissMode = Platform.OS === 'ios' ? 'interactive' : 'on-drag',
  keyboardShouldPersistTaps = 'handled',
  ...props
}: ScrollViewProps & { bottomOffset?: number }) {
  return (
    <ControllerKeyboardAwareScrollView
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      bottomOffset={bottomOffset}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </ControllerKeyboardAwareScrollView>
  );
}
