import { expect, test } from 'bun:test';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';

const examples: Partial<Record<Locale, [string, string]>> = {
  en: [
    'For the next release, reduce transfers.',
    'For the new URLs in the next release, reduce transfers.',
  ],
  'zh-CN': ['对于下一次发布，减少传输量。', '对于下一次发布的新 URL，减少传输量。'],
  'zh-TW': ['對於下一次發佈，減少傳輸量。', '對於下一次發佈的新 URL，減少傳輸量。'],
  ko: ['다음 릴리스에서 전송량을 줄입니다.', '다음 릴리스의 새 URL에서는 전송량을 줄입니다.'],
  pt: [
    'Na próxima versão, reduza as transferências.',
    'Para as novas URLs da próxima versão, reduza as transferências.',
  ],
  fr: [
    'Pour la prochaine publication, réduisez les transferts.',
    'Pour les nouvelles URL de la prochaine publication, réduisez les transferts.',
  ],
  de: [
    'Bei der nächsten Veröffentlichung die Übertragung reduzieren.',
    'Für die neuen URLs der nächsten Veröffentlichung die Übertragung reduzieren.',
  ],
  es: [
    'En la próxima publicación, reduzca las transferencias.',
    'Para las nuevas URL de la próxima publicación, reduzca las transferencias.',
  ],
  it: [
    'Per il prossimo rilascio riduci i trasferimenti.',
    'Per i nuovi URL del prossimo rilascio riduci i trasferimenti.',
  ],
};

test('all nine locales retain the new-URL condition for automatic CloudFront compression', () => {
  const source = 'CloudFrontで、次回公開の新URLでは圧縮して転送量を減らす。';
  for (const [locale, [omitted, retained]] of Object.entries(examples)) {
    expect(() => assertNativeLanguage(source, omitted, locale as Locale, 'prompt')).toThrow(
      'new URL condition',
    );
    expect(() => assertNativeLanguage(source, retained, locale as Locale, 'prompt')).not.toThrow();
    expect(() =>
      assertNativeLanguage('CloudFrontの転送量を減らす。', omitted, locale as Locale, 'prompt'),
    ).not.toThrow();
  }
});

test('new URL qualifiers allow natural adjective placement and Chinese particles', () => {
  const source = 'CloudFrontで、次回公開の新URLでは圧縮して転送量を減らす。';
  for (const [locale, translated] of [
    ['pt', 'Na próxima versão, para URLs novas, reduza as transferências.'],
    ['es', 'En la próxima publicación, para URL nuevas, reduzca las transferencias.'],
    ['zh-CN', '对于下一次发布的新的 URL，减少传输量。'],
    ['zh-TW', '對於下一次發佈的新的 URL，減少傳輸量。'],
  ] as const)
    expect(() => assertNativeLanguage(source, translated, locale, 'prompt')).not.toThrow();
});
