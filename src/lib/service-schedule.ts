export const SCHEDULE_TIME_SLOTS = Array.from(
  { length: 13 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`
);

/** Calendar days in the device's time zone, rather than UTC or 24-hour offsets. */
export function buildScheduleDayOptions(now = new Date(), days = 7): string[] {
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(days) || days < 1 || days > 366) {
    throw new RangeError('Invalid schedule day range');
  }
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index, 12);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  });
}

/** Return null for invalid dates or local times skipped by a clock change. */
export function combineSchedule(day: string, slot: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !SCHEDULE_TIME_SLOTS.includes(slot)) return null;
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = slot.split(':').map(Number);
  const value = new Date(year, month - 1, date, hour, minute);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 ||
      value.getDate() !== date || value.getHours() !== hour || value.getMinutes() !== minute) {
    return null;
  }
  return value.toISOString();
}

export function isFutureSchedule(value: string | null, now = new Date()): boolean {
  return value !== null && new Date(value).getTime() > now.getTime();
}

export function formatScheduledFor(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatScheduleDay(day: string, locale: string): string {
  const value = combineSchedule(day, '12:00');
  return value ? new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(value)) : '';
}
