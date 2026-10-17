import { Alert, Linking, Platform } from 'react-native';

type Translate = (text: string) => string;
type ContactNumbers = { phone: string; whatsapp: string };

// Dialers reject spaces/dashes on some Android builds; wa.me accepts digits only.
export function phoneCallUrl(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function whatsAppUrl(number: string) {
  return `https://wa.me/${number.replace(/\D/g, '')}`;
}

export function smsUrl(phone: string) {
  return `sms:${phone.replace(/[^\d+]/g, '')}`;
}

// Lebanese mobile ranges (03, 70, 71, 76, 78, 79, 81). Landlines (01, 04…)
// cannot receive WhatsApp or SMS, so they get no message option.
export function isLebaneseMobileNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('961') ? digits.slice(3) : digits.replace(/^0/, '');
  return /^(3\d{6}|(70|71|76|78|79|81)\d{6})$/.test(local);
}

export function canMessage({ phone, whatsapp }: ContactNumbers) {
  return Boolean(whatsapp) || isLebaneseMobileNumber(phone);
}

// openURL rejects when no app handles the link (tablets, emulators, no WhatsApp).
export async function openContactUrl(url: string, t: Translate) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(t('Could not open link'), t('Check that an app for this action is installed, then try again.'));
  }
}

// A listed WhatsApp number opens directly; a mobile number offers WhatsApp or SMS.
export function openMessage({ phone, whatsapp }: ContactNumbers, t: Translate) {
  if (whatsapp) {
    void openContactUrl(whatsAppUrl(whatsapp), t);
    return;
  }
  // React Native Web's Alert is a no-op, and browsers rarely handle sms: links.
  if (Platform.OS === 'web') {
    void openContactUrl(whatsAppUrl(phone), t);
    return;
  }
  Alert.alert(t('Message provider'), t('Choose how to send your message.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('WhatsApp'), onPress: () => void openContactUrl(whatsAppUrl(phone), t) },
    { text: t('Text message'), onPress: () => void openContactUrl(smsUrl(phone), t) },
  ]);
}
