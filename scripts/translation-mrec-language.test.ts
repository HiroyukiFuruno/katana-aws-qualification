import { expect, test } from 'bun:test';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';

const observedJapaneseMrecSource = '複数リージョン結果整合性を利用している。';
const oldGenericTranslations = {
  en: 'A DynamoDB Global Table uses multi-Region consistency.',
  'zh-CN': 'DynamoDB Global Tables使用多区域一致性。',
  'zh-TW': 'DynamoDB Global Tables 使用多區域一致性。',
  ko: 'DynamoDB Global Tables에서 다중 리전 일관성을 사용하고 있다.',
  pt: 'Uma DynamoDB Global Table usa consistência entre regiões.',
  fr: 'Une DynamoDB Global Table utilise une cohérence entre régions.',
  de: 'Eine DynamoDB Global Table verwendet Konsistenz über mehrere Regionen.',
  es: 'Una DynamoDB Global Table utiliza coherencia entre regiones.',
  it: 'Una DynamoDB Global Table utilizza la coerenza tra regioni.',
} as const;

test('the shared native-language entry point rejects all nine generic MREC before values', () => {
  for (const [locale, translated] of Object.entries(oldGenericTranslations)) {
    expect(() =>
      assertNativeLanguage(observedJapaneseMrecSource, translated, locale as Locale, `mrec-${locale}`),
    ).toThrow('MREC eventual consistency');
  }
});

test('all nine native eventual-consistency terms are accepted without the acronym', () => {
  const translations = {
    en: 'multi-Region eventual consistency',
    'zh-CN': '多区域最终一致性',
    'zh-TW': '多區域最終一致性',
    ko: '다중 리전 최종 일관성',
    pt: 'consistência eventual em várias regiões',
    fr: 'cohérence éventuelle multirégionale',
    de: 'letztendliche Konsistenz über mehrere Regionen',
    es: 'coherencia eventual entre regiones',
    it: 'consistenza eventuale tra regioni',
  } as const;
  for (const [locale, translated] of Object.entries(translations)) {
    expect(() =>
      assertNativeLanguage(
        observedJapaneseMrecSource,
        translated,
        locale as Locale,
        `mrec-no-acronym-${locale}`,
      ),
    ).not.toThrow();
  }
});

test('English source requires a Japanese eventual-consistency term at the boundary', () => {
  const source = 'A DynamoDB Global Table uses multi-Region eventual consistency (MREC).';
  expect(() =>
    assertNativeLanguage(source, 'マルチリージョンの結果整合性（MREC）', 'ja', 'mrec-ja'),
  ).not.toThrow();
  expect(() => assertNativeLanguage(source, '複数リージョンの一貫性', 'ja', 'mrec-ja-bad')).toThrow(
    'MREC eventual consistency',
  );
});

test('regional endpoint wording and unrelated consistency literals remain outside scope', () => {
  expect(() =>
    assertNativeLanguage(
      'Configure the regional endpoint.',
      'Configure the regional endpoint.',
      'en',
      'endpoint',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'A table uses multi-Region consistency.',
      'multi-Region consistency',
      'en',
      'generic',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      'A table uses multi-Region strong consistency (MRSC).',
      'multi-Region consistency',
      'en',
      'mrsc',
    ),
  ).not.toThrow();
});

test('MREC sources may also describe strong local reads without broad rejection', () => {
  const source =
    'A table uses multi-Region eventual consistency; local reads can use strong consistency.';
  expect(() =>
    assertNativeLanguage(source, 'multi-Region consistency', 'en', 'mrec-local-strong-bad'),
  ).toThrow('MREC eventual consistency');
  expect(() =>
    assertNativeLanguage(
      source,
      'multi-Region eventual consistency across Regions with strong consistency for local reads',
      'en',
      'mrec-local-strong-good',
    ),
  ).not.toThrow();
});

test('MREC does not silently become MRSC-only', () => {
  expect(() =>
    assertNativeLanguage(
      'A table uses multi-Region eventual consistency (MREC).',
      'multi-Region strong consistency (MRSC)',
      'en',
      'mrec-to-mrsc',
    ),
  ).toThrow('MREC eventual consistency');
});

test('native eventual aliases remain accepted across Spanish, Italian, Korean, and German', () => {
  const cases = [
    ['es', 'consistencia eventual entre regiones'],
    ['it', 'coerenza eventuale tra regioni'],
    ['ko', '다중 리전 결과적 일관성'],
    ['de', 'letztendlich konsistente Replikate über mehrere Regionen'],
  ] as const;
  for (const [locale, translated] of cases) {
    expect(() =>
      assertNativeLanguage(
        'マルチリージョンの結果整合性を利用する。',
        translated,
        locale,
        `mrec-alias-${locale}`,
      ),
    ).not.toThrow();
  }
});

test('NFC normalization is meaningful for a decomposed French eventual term', () => {
  const source = `e\u0301 マルチリージョン結果整合性を利用する。`;
  const check = (translated: string, context: string) =>
    assertNativeLanguage(source, translated, 'fr', context);
  expect(() => check('cohérence entre régions', 'mrec-fr-nfc-bad')).toThrow('MREC eventual consistency');
  expect(() =>
    check('cohe\u0301rence e\u0301ventuelle multire\u0301gionale', 'mrec-fr-nfc'),
  ).not.toThrow();
});
