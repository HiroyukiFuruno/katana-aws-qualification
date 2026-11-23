import { expect, test } from 'bun:test';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';

const source =
  'The cache may retain the old value after the update and cannot guarantee this read-after-write requirement.';
const oldBefore = {
  ja: 'キャッシュには更新後も古い値が残る可能性があり、この読み取り後書き込み要件を保証できません。',
  'zh-CN': '更新后缓存可能仍保留旧值，无法保证读取操作满足此读取后写入要求。',
  'zh-TW': '更新後快取可能仍保留舊值，無法保證此讀取後寫入需求。',
  ko: '업데이트 후에도 캐시에 이전 값이 남을 수 있으므로 이 읽기 후 쓰기 요구 사항을 보장할 수 없습니다.',
} as const;
const fixedAfter = {
  en: source,
  ja: 'キャッシュには更新後も古い値が残る可能性があり、書き込み後の読み取り要件を保証できません。',
  'zh-CN': '更新后缓存可能仍保留旧值，无法保证此写入后读取要求。',
  'zh-TW': '更新後快取可能仍保留舊值，無法保證此寫入後讀取需求。',
  ko: '업데이트 후에도 캐시에 이전 값이 남을 수 있으므로 이 쓰기 후 읽기 요구 사항을 보장할 수 없습니다.',
  pt: 'O cache pode manter o valor antigo após a atualização e não pode garantir esse requisito de leitura após gravação.',
  fr: 'Le cache peut conserver l’ancienne valeur après la mise à jour et ne peut pas garantir cette exigence de lecture après écriture.',
  de: 'Der Cache kann nach der Aktualisierung den alten Wert behalten und diese Anforderung für Lesen nach dem Schreiben nicht garantieren.',
  es: 'La caché puede conservar el valor anterior después de la actualización y no puede garantizar este requisito de lectura posterior a la escritura.',
  it: "La cache può conservare il valore precedente dopo l'aggiornamento e non può garantire questo requisito di lettura dopo scrittura.",
} as const;

test('rejects the immutable JA reversed before value', () => {
  expect(() => assertNativeLanguage(source, oldBefore.ja, 'ja', 'read-after-write-red-ja')).toThrow(
    'read-after-write order reversed',
  );
});

test('rejects the immutable zh-CN reversed before value', () => {
  expect(() =>
    assertNativeLanguage(source, oldBefore['zh-CN'], 'zh-CN', 'read-after-write-red-zh-CN'),
  ).toThrow('read-after-write order reversed');
});

test('rejects the immutable zh-TW reversed before value', () => {
  expect(() =>
    assertNativeLanguage(source, oldBefore['zh-TW'], 'zh-TW', 'read-after-write-red-zh-TW'),
  ).toThrow('read-after-write order reversed');
});

test('rejects the immutable Korean reversed before value', () => {
  expect(() => assertNativeLanguage(source, oldBefore.ko, 'ko', 'read-after-write-red-ko')).toThrow(
    'read-after-write order reversed',
  );
});

test('the shared native-language entry point accepts the corrected native order for all locales', () => {
  for (const [locale, translated] of Object.entries(fixedAfter)) {
    expect(() =>
      assertNativeLanguage(source, translated, locale as Locale, `read-after-write-green-${locale}`),
    ).not.toThrow();
  }
});

test('explicit contrast between reversed and forward order is accepted in the four affected locales', () => {
  const contrast = {
    ja: '読み取り後書き込みではなく、書き込み後の読み取りを保証する。',
    'zh-CN': '不是读取后写入，而是保证写入后读取。',
    'zh-TW': '不是讀取後寫入，而是保證寫入後讀取。',
    ko: '읽기 후 쓰기가 아니라 쓰기 후 읽기를 보장합니다.',
  } as const;
  for (const [locale, translated] of Object.entries(contrast)) {
    expect(() =>
      assertNativeLanguage(source, translated, locale as Locale, `read-after-write-contrast-${locale}`),
    ).not.toThrow();
  }
});

test('the guard scopes only to an explicit read-after-write source', () => {
  expect(() =>
    assertNativeLanguage(
      'Write-after-read processing is required.',
      '읽기 후 쓰기 처리',
      'ko',
      'out-of-scope',
    ),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage('A cache has an old value.', '읽기 후 쓰기', 'ko', 'no-cue'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(source, 'e\u0301criture après lecture', 'fr', 'nfc-reversed'),
  ).toThrow('read-after-write order reversed');
});
