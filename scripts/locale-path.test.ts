import { expect, test } from 'bun:test';
import { localeForPath, locales } from '../src/locales';

test('unknown routes retain only an exact supported locale prefix', () => {
  for (const locale of locales) {
    expect(localeForPath(`/${locale}/not-registered/`)).toBe(locale);
  }
  for (const path of ['/', '/unknown/', '/japanese/unknown/', 'ja/unknown/', '//ja/unknown/']) {
    expect(localeForPath(path)).toBe('en');
  }
});
