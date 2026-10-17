import { useState } from 'react';

import OptionSheet from '@/components/option-sheet';
import { formatPhoneForDisplay, openContactUrl, smsUrl, whatsAppUrl } from '@/lib/contact-links';
import { useLocalization } from '@/providers/LocalizationProvider';

type ContactNumbers = { name: string; phone: string; whatsapp: string };

// A listed WhatsApp number opens directly; a mobile number offers WhatsApp or SMS
// in the app's own sheet rather than a platform alert.
export function useMessageSheet({ name, phone, whatsapp }: ContactNumbers) {
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);

  const openMessage = () => {
    if (whatsapp) void openContactUrl(whatsAppUrl(whatsapp), t);
    else setOpen(true);
  };

  const sheet = open ? (
    <OptionSheet
      visible
      title={`${t('Message')} ${name}`}
      subtitle={formatPhoneForDisplay(phone)}
      onClose={() => setOpen(false)}
      options={[
        { key: 'whatsapp', label: 'WhatsApp', description: 'Opens a chat in WhatsApp.', icon: 'logo-whatsapp',
          onPress: () => void openContactUrl(whatsAppUrl(phone), t) },
        { key: 'sms', label: 'Text message', description: 'Uses your phone’s messaging app.',
          icon: 'chatbubble-ellipses-outline', onPress: () => void openContactUrl(smsUrl(phone), t) },
      ]}
    />
  ) : null;

  return { openMessage, sheet };
}
