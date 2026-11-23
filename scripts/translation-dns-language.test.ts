import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';
import { assertZonalDnsLanguage } from './translation-dns-language';

const source = '各エンドポイントのAZに対応するゾーン固有のDNS名を設定する。';

test('Traditional Chinese rejects a bare regional DNS term for a standalone zonal name', () => {
  expect(() => assertZonalDnsLanguage(source, '端點專用區域 DNS 名稱', 'zh-TW', 'd1-035')).toThrow(
    'zonal DNS terminology',
  );
});

test('Traditional Chinese accepts explicit availability-zone DNS terms', () => {
  expect(() =>
    assertZonalDnsLanguage(source, '端點專用可用區 DNS 名稱', 'zh-TW', 'd1-035'),
  ).not.toThrow();
  expect(() =>
    assertZonalDnsLanguage(source, '端點專用可用區域 DNS 名稱', 'zh-TW', 'd1-035'),
  ).not.toThrow();
});

test('mixed regional and zonal fields remain outside the unconditional ban', () => {
  const mixedSource = 'リージョン別の名前とゾーン固有のDNS名を使い分ける。';
  expect(() =>
    assertZonalDnsLanguage(mixedSource, '區域名稱與可用區 DNS 名稱分別使用。', 'zh-TW', 'mixed'),
  ).not.toThrow();
});

test('non-Traditional Chinese and regional-only fields are outside this guard', () => {
  expect(() => assertZonalDnsLanguage(source, 'Regional DNS name', 'en', 'english')).not.toThrow();
  expect(() =>
    assertZonalDnsLanguage('リージョン別のDNS名を使う。', '區域 DNS 名稱', 'zh-TW', 'regional'),
  ).not.toThrow();
});

test('the shared native-language entry point rejects the real Japanese and English standalone cues', () => {
  const japanese = '各アプリのAZに対応するエンドポイント固有のゾーンDNS名を設定する。';
  const english = 'Interface endpoints provide zonal DNS names.';
  expect(() => assertNativeLanguage(japanese, '端點專用區域 DNS 名稱', 'zh-TW', 'd1-035-D')).toThrow(
    'zonal DNS terminology',
  );
  expect(() => assertNativeLanguage(english, '端點專用區域 DNS 名稱', 'zh-TW', 'd1-035-D-en')).toThrow(
    'zonal DNS terminology',
  );
});

test('hosted-zone DNS without an AZ or zonal cue remains outside the guard', () => {
  expect(() =>
    assertNativeLanguage(
      'エンドポイントからホストゾーンDNS名を解決する。',
      '解析端點的託管區域 DNS 名稱。',
      'zh-TW',
      'hosted-zone',
    ),
  ).not.toThrow();
});

test('an endpoint field that contrasts Regional and zonal DNS remains valid', () => {
  const mixedSource = 'Interface endpoints provide Regional and zonal DNS names.';
  expect(() =>
    assertNativeLanguage(
      mixedSource,
      '區域 DNS 名稱與可用區 DNS 名稱分別使用。',
      'zh-TW',
      'mixed-endpoint',
    ),
  ).not.toThrow();
});

test('source literal regional DNS wording with or without a space is preserved', () => {
  expect(() =>
    assertZonalDnsLanguage(
      'エンドポイントは區域 DNS 名稱を提供する。',
      '區域 DNS 名稱',
      'zh-TW',
      'literal-space',
    ),
  ).not.toThrow();
  expect(() =>
    assertZonalDnsLanguage(
      'エンドポイントは區域DNS名稱を提供する。',
      '區域DNS名稱',
      'zh-TW',
      'literal-tight',
    ),
  ).not.toThrow();
});

test('NFC normalization keeps a protected availability-zone source literal protected', () => {
  const source = `e\u0301 各エンドポイントのAZに対応するゾーン固有のDNS名と可用區域 DNS 名稱。`;
  expect(() => assertZonalDnsLanguage(source, '端點專用區域 DNS 名稱', 'zh-TW', 'nfc-literal')).toThrow(
    'zonal DNS terminology',
  );
});
