import { expect, test } from 'bun:test';
import { assertNativeLanguage } from './content-language-issues';

const sourceV1 =
  'ユーザープロファイルを2リージョンのアプリが平時から読み書きする。書き込み先リージョンが停止しても対向リージョンへの接続変更で書き込みを継続したい。競合があった場合の最終書き込み優先を許容する。 双方向複製と競合解決はAWSに任せたい。';
const sourceV2 =
  '2リージョンのアプリがユーザープロファイルをそれぞれローカルで読み書きする。リージョンAが停止してもBへの書き込みを継続する。リージョン間では結果整合性と最終書き込み優先を許容し、アプリに複製や競合解決の処理は追加できない。何を選ぶか。';
const sourceDop =
  'MRECでは各リージョン間で同じ項目が同時変更されると最後の書込みが勝つ。項目単位に一つの所有リージョンを定めると競合経路を除ける。';

test('rejects the observed zh-CN first-writer inversion at the shared entry point', () => {
  expect(() =>
    assertNativeLanguage(
      sourceV2,
      '一个部署在两个区域的应用分别在本地区域读取和写入用户资料。即使区域 A 停止运行，也必须继续接受区域 B 的写入。应用可以容忍区域间的最终一致性和最先写入者胜出的冲突解决方式，并且无法在应用中添加复制或冲突解决逻辑。应选择哪项方案？',
      'zh-CN',
      'lww-zh-cn-p1',
    ),
  ).toThrow('last-writer');
});

test('accepts natural last-writer wording in Chinese targets', () => {
  const cases = [
    [sourceV1, '可接受发生冲突时采用最后写入者优先。', 'zh-CN'],
    [sourceV1, '可接受發生衝突時由最後寫入者優先。', 'zh-TW'],
    [sourceV2, '冲突按最后写入者胜出方式解决。', 'zh-CN'],
    [sourceV2, '以最後寫入者勝出的方式解決衝突。', 'zh-TW'],
    [sourceDop, '在 MREC 模式下，可能由最后写入的更改胜出。', 'zh-CN'],
    [sourceDop, 'MREC 中，最後寫入者可能勝出。', 'zh-TW'],
  ] as const;
  for (const [source, translated, locale] of cases)
    expect(() => assertNativeLanguage(source, translated, locale, `lww-${locale}`)).not.toThrow();
});

test('keeps unrelated first or last wording outside the LWW guard', () => {
  expect(() =>
    assertNativeLanguage('最初の接続先を使う。', '最先写入者胜出。', 'zh-CN', 'ordinary-first'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage('マルチリージョン強整合性を使う。', '最先写入者胜出。', 'zh-CN', 'mrsc'),
  ).not.toThrow();
  expect(() =>
    assertNativeLanguage(
      sourceV2,
      '先写入者的结果可能先出现，但冲突最终由最后写入者胜出。',
      'zh-CN',
      'lww-contrast',
    ),
  ).not.toThrow();
});

test('accepts each named LWW policy literal independently in Chinese targets', () => {
  for (const [locale, translated] of [
    ['zh-CN', '使用 LWW 解决冲突。'],
    ['zh-TW', '使用 LWW 解決衝突。'],
    ['zh-CN', '使用 last-writer-wins 解决冲突。'],
    ['zh-TW', '使用 last-writer-wins 解決衝突。'],
    ['zh-CN', '使用 last writer wins 解决冲突。'],
    ['zh-TW', '使用 last writer wins 解決衝突。'],
  ] as const)
    expect(() =>
      assertNativeLanguage(sourceV1, translated, locale, `lww-named-${locale}`),
    ).not.toThrow();
});

test('recognizes an English LWW source cue separately', () => {
  expect(() =>
    assertNativeLanguage(
      'DynamoDB Global Tables use LWW for conflict resolution.',
      '使用 LWW 解决冲突。',
      'zh-CN',
      'lww-english-source',
    ),
  ).not.toThrow();
});
