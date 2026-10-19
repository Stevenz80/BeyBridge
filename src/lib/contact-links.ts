import { Linking } from 'react-native';
import { showAlert } from '@/lib/alert';

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

// "+96176608658" -> "+961 76 608 658"; other numbers are shown as stored.
export function formatPhoneForDisplay(phone: string) {
  const match = phone.replace(/[^\d+]/g, '').match(/^\+961(1|3|4|5|6|7|8|9|70|71|76|78|79|81)(\d{3})(\d{3})$/);
  return match ? `+961 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

export function canMessage({ phone, whatsapp }: ContactNumbers) {
  return Boolean(whatsapp) || isLebaneseMobileNumber(phone);
}

// openURL rejects when no app handles the link (tablets, emulators, no WhatsApp).
export async function openContactUrl(url: string, t: Translate) {
  try {
    await Linking.openURL(url);
  } catch {
    showAlert(t('Could not open link'), t('Check that an app for this action is installed, then try again.'));
  }
}
