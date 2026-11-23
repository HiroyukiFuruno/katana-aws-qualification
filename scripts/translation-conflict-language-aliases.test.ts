import { expect, test } from 'bun:test';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';

type Binding = {
  sourceHash: string;
  fieldPath: string;
  locale: 'zh-CN' | 'zh-TW';
  source: string;
  translated: string;
  valid: boolean;
};

const v1Prompt =
  'ユーザープロファイルを2リージョンのアプリが平時から読み書きする。書き込み先リージョンが停止しても対向リージョンへの接続変更で書き込みを継続したい。競合があった場合の最終書き込み優先を許容する。 双方向複製と競合解決はAWSに任せたい。';
const v1Explanation = '各レプリカに書き込め、競合は最終書き込み優先で解決する。';
const bindings: Binding[] = [
  {
    sourceHash: 'c3a31fddb4bb0ba3190fbc992fa0a7605d41fd2a00f65fbb9e98e4aa4d5f5651',
    fieldPath: 'prompt',
    locale: 'zh-CN',
    source: v1Prompt,
    translated:
      '两个区域中的应用程序在正常运行时会读写用户配置文件。如果接收写入的区域不可用，希望通过更改连接到另一个区域来继续写入。可以接受发生冲突时采用最后写入者优先。希望由 AWS 管理双向复制和冲突解决。',
    valid: true,
  },
  {
    sourceHash: 'c3a31fddb4bb0ba3190fbc992fa0a7605d41fd2a00f65fbb9e98e4aa4d5f5651',
    fieldPath: 'prompt',
    locale: 'zh-TW',
    source: v1Prompt,
    translated:
      '兩個區域中的應用程式在正常運作時會讀寫使用者設定檔。若接收寫入的區域無法使用，希望透過變更連線至另一個區域來繼續寫入。可接受發生衝突時由最後寫入者優先。希望由 AWS 管理雙向複寫和衝突解決。',
    valid: true,
  },
  {
    sourceHash: 'c3a31fddb4bb0ba3190fbc992fa0a7605d41fd2a00f65fbb9e98e4aa4d5f5651',
    fieldPath: 'choices[0].explanation',
    locale: 'zh-CN',
    source: v1Explanation,
    translated: '每个副本都可以接受写入，并使用最后写入者优先来解决冲突。',
    valid: true,
  },
  {
    sourceHash: 'c3a31fddb4bb0ba3190fbc992fa0a7605d41fd2a00f65fbb9e98e4aa4d5f5651',
    fieldPath: 'choices[0].explanation',
    locale: 'zh-TW',
    source: v1Explanation,
    translated: '每個副本都可以接受寫入，並以最後寫入者優先解決衝突。',
    valid: true,
  },
  {
    sourceHash: 'c3a31fddb4bb0ba3190fbc992fa0a7605d41fd2a00f65fbb9e98e4aa4d5f5651',
    fieldPath: 'learning.reason',
    locale: 'zh-CN',
    source: v1Explanation,
    translated: '每个副本都可以接受写入，并使用最后写入者优先来解决冲突。',
    valid: true,
  },
  {
    sourceHash: 'c3a31fddb4bb0ba3190fbc992fa0a7605d41fd2a00f65fbb9e98e4aa4d5f5651',
    fieldPath: 'learning.reason',
    locale: 'zh-TW',
    source: v1Explanation,
    translated: '每個副本都可以接受寫入，並以最後寫入者優先解決衝突。',
    valid: true,
  },
];

test('the v1 inventory leaves retain LWW semantics in both Chinese locales', () => {
  expect(bindings).toHaveLength(6);
  for (const binding of bindings) {
    const check = () =>
      assertNativeLanguage(
        binding.source,
        binding.translated,
        binding.locale as Locale,
        `${binding.sourceHash}:${binding.fieldPath}`,
      );
    if (binding.valid) expect(check).not.toThrow();
    else expect(check).toThrow('last-writer');
  }
});
