import { type Locale, localePath } from '../locales';

export function callbackCode(search: string) {
  const params = new URLSearchParams(search);
  const codes = params.getAll('code');
  if (params.has('error') || params.has('error_code') || codes.length !== 1 || !codes[0].trim()) {
    throw new Error('Invalid authentication callback');
  }
  return codes[0];
}

export function callbackPath(locale: Locale) {
  return localePath(locale, 'auth/callback');
}

export function dashboardPath(locale: Locale) {
  return localePath(locale, 'dashboard');
}
