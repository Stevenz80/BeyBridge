export type AppLocale = 'en' | 'ar';

export const LOCALE_STORAGE_KEY = 'beybridge.preferred-language';

// Readable outside React and providers (auth sign-up, error screens).
export function readStoredLocale(): AppLocale {
  try {
    return globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function writeStoredLocale(locale: AppLocale) {
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The selected locale still applies for the current session.
  }
}

// Locale for Intl date/number formatting: Arabic month names with Latin digits in
// Arabic (common for Lebanese prices and dates), English otherwise.
export function intlLocale() {
  return readStoredLocale() === 'ar' ? 'ar-LB-u-nu-latn' : 'en';
}
