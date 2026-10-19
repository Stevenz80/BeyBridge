import { Platform } from 'react-native';
import { showAlert, translateForAlert } from '@/lib/alert';

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
    if (globalThis.confirm(`${translateForAlert(title)}\n\n${translateForAlert(message)}`)) onConfirm();
    return;
  }
  showAlert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
