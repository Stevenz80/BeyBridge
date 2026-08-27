import type { Provider } from './types';

const BEIRUT_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Beirut',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export type ProviderOpenStatus = {
  isOpen: boolean;
  label: 'Open now' | 'Closed' | 'Emergency calls' | 'Hours unavailable';
};

export function getProviderOpenStatus(
  provider: Pick<Provider, 'openingHours' | 'emergencyService'>,
  now = new Date()
): ProviderOpenStatus {
  const parts = BEIRUT_TIME_FORMATTER.formatToParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase();
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  const hours = weekday ? provider.openingHours[weekday] : undefined;

  if (!hours || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { isOpen: false, label: 'Hours unavailable' };
  }

  const normalizedHours = hours.trim().toLowerCase();
  if (normalizedHours.includes('24 hour') || normalizedHours === 'open') {
    return { isOpen: true, label: 'Open now' };
  }
  if (normalizedHours.includes('emergency')) {
    return {
      isOpen: Boolean(provider.emergencyService),
      label: 'Emergency calls',
    };
  }
  if (normalizedHours.includes('closed')) {
    return { isOpen: false, label: 'Closed' };
  }

  const range = normalizedHours.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[\u2013\u2014-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i
  );
  if (!range) return { isOpen: false, label: 'Hours unavailable' };

  const startMinutes = toMinutes(Number(range[1]), Number(range[2] ?? 0), range[3]);
  const endMinutes = toMinutes(Number(range[4]), Number(range[5] ?? 0), range[6]);
  const currentMinutes = hour * 60 + minute;
  const isOpen =
    endMinutes >= startMinutes
      ? currentMinutes >= startMinutes && currentMinutes <= endMinutes
      : currentMinutes >= startMinutes || currentMinutes <= endMinutes;

  return { isOpen, label: isOpen ? 'Open now' : 'Closed' };
}

function toMinutes(hour: number, minute: number, period?: string) {
  let normalizedHour = hour;
  if (period?.toLowerCase() === 'am' && normalizedHour === 12) normalizedHour = 0;
  if (period?.toLowerCase() === 'pm' && normalizedHour < 12) normalizedHour += 12;
  return normalizedHour * 60 + minute;
}
