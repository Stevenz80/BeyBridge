import { Alert, Linking } from 'react-native';

type Translate = (text: string) => string;

// Dialers reject spaces/dashes on some Android builds; wa.me accepts digits only.
export function phoneCallUrl(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function whatsAppUrl(number: string) {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}

// openURL rejects when no app handles the link (tablets, emulators, no WhatsApp).
export async function openContactUrl(url: string, t: Translate) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('Could not open link'), t('Check that an app for this action is installed, then try again.'));
  }
}
