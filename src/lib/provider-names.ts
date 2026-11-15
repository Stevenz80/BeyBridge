import type { Provider } from './types';

const ARABIC_SCRIPT = /[؀-ۿ]/;

// Directory entries keep every name mapped for a business. Returns the names to
// swap for the reader's language: a Latin-script name in English, an Arabic one
// in Arabic. Listings with a single name, or one already in that script, are left alone.
export function localizedProviderNames(providers: Provider[], locale: 'en' | 'ar') {
  const wantsArabic = locale === 'ar';
  const names = new Map<string, string>();
  for (const provider of providers) {
    if (ARABIC_SCRIPT.test(provider.name) === wantsArabic) continue;
    const alternative = provider.mapSource?.names?.find(
      (name) => name.trim() && ARABIC_SCRIPT.test(name) === wantsArabic
    );
    if (alternative) names.set(provider.name, alternative.trim());
  }
  return names;
}
