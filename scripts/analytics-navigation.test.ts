import { expect, test } from 'bun:test';
import { analyticsAllowedForPath } from '../src/analyticsNavigation';
import { localePath, locales } from '../src/locales';

test('private lesson results, finals and account pages never enable analytics', () => {
  for (const locale of locales) {
    for (const page of [
      'login',
      'dashboard',
      'auth/callback',
      'study/fundamentals/cloud-concepts/final/1',
      'study/fundamentals/cloud-concepts/result',
    ]) {
      expect(analyticsAllowedForPath(localePath(locale, page), true)).toBe(false);
    }
    const reading = localePath(locale, 'study/fundamentals/cloud-concepts/slides/1');
    expect(analyticsAllowedForPath(reading, true)).toBe(true);
    expect(analyticsAllowedForPath(reading, false)).toBe(false);
  }
  expect(analyticsAllowedForPath('/unknown/', true)).toBe(false);
});
