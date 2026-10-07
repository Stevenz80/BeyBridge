import { Alert, Platform } from 'react-native';

export function confirmAction({ title, message, confirmLabel, cancelLabel, destructive, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  // React Native Web's Alert implementation is a no-op.
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
