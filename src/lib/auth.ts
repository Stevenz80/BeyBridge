export type AuthCallbackValues = {
  accessToken: string | null;
  refreshToken: string | null;
  authorizationCode: string | null;
  errorMessage: string | null;
};

export function normalizePhoneNumber(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  if (international.startsWith('+')) return `+${international.slice(1).replace(/\D/g, '')}`;

  const digits = international.replace(/\D/g, '');
  if (!digits) return '';

  // BeyBridge currently serves Lebanon, so local numbers default to +961.
  return `+961${digits.startsWith('0') ? digits.slice(1) : digits}`;
}

export function isValidPhoneNumber(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export function parseAuthCallbackUrl(url: string): AuthCallbackValues {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const value = (key: string) => fragment.get(key) ?? parsed.searchParams.get(key);

  return {
    accessToken: value('access_token'),
    refreshToken: value('refresh_token'),
    authorizationCode: value('code'),
    errorMessage: value('error_description') ?? value('error'),
  };
}

export function maskPhoneNumber(phone: string) {
  if (phone.length <= 6) return phone;
  return `${phone.slice(0, 4)} ••• ••${phone.slice(-2)}`;
}
