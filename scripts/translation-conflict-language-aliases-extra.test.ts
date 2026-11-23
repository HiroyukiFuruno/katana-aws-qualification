import { expect, test } from 'bun:test';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues';

const sourceV2 =
  '2リージョンのアプリがユーザープロファイルをそれぞれローカルで読み書きする。リージョンAが停止してもBへの書き込みを継続する。リージョン間では結果整合性と最終書き込み優先を許容し、アプリに複製や競合解決の処理は追加できない。何を選ぶか。';
const sourceExplanation = '各レプリカに書き込め、競合は最終書き込み優先で解決する。';
const sourceReason =
  '両リージョンで平時から書き込み、結果整合と最終書き込み優先を許容する条件が決め手。';
const sourceDop =
  'MRECでは各リージョン間で同じ項目が同時変更されると最後の書込みが勝つ。項目単位に一つの所有リージョンを定めると競合経路を除ける。';

const bindings = [
  {
    hash: '11e0c7913e313f992381b478070d5653a434f8287594da71549bf6c691421ae2',
    field: 'prompt',
    locale: 'zh-CN',
    source: sourceV2,
    target:
      '一个部署在两个区域的应用分别在本地区域读取和写入用户资料。即使区域 A 停止运行，也必须继续接受区域 B 的写入。应用可以容忍区域间的最终一致性和最先写入者胜出的冲突解决方式，并且无法在应用中添加复制或冲突解决逻辑。应选择哪项方案？',
    valid: false,
  },
  {
    hash: '11e0c7913e313f992381b478070d5653a434f8287594da71549bf6c691421ae2',
    field: 'prompt',
    locale: 'zh-TW',
    source: sourceV2,
    target:
      '部署在兩個區域的應用程式分別在本地區域讀取和寫入使用者設定檔。即使區域 A 停止運作，仍必須繼續接受區域 B 的寫入。應用程式可以容忍區域間的最終一致性和最後寫入者勝出的衝突解決方式，而且無法在應用程式中加入複寫或衝突解決邏輯。應選擇哪個選項？',
    valid: true,
  },
  {
    hash: '11e0c7913e313f992381b478070d5653a434f8287594da71549bf6c691421ae2',
    field: 'choices[2].explanation',
    locale: 'zh-CN',
    source: sourceExplanation,
    target: '每个副本都可以接受写入，冲突按最后写入者胜出方式解决。',
    valid: true,
  },
  {
    hash: '11e0c7913e313f992381b478070d5653a434f8287594da71549bf6c691421ae2',
    field: 'choices[2].explanation',
    locale: 'zh-TW',
    source: sourceExplanation,
    target: '每個複本都可以接受寫入，並以最後寫入者勝出的方式解決衝突。',
    valid: true,
  },
  {
    hash: '11e0c7913e313f992381b478070d5653a434f8287594da71549bf6c691421ae2',
    field: 'learning.reason',
    locale: 'zh-CN',
    source: sourceReason,
    target:
      '关键要求是两个区域在正常运行期间都能接受写入，并且能够容忍最终一致性和最后写入者胜出式冲突解决。',
    valid: true,
  },
  {
    hash: '11e0c7913e313f992381b478070d5653a434f8287594da71549bf6c691421ae2',
    field: 'learning.reason',
    locale: 'zh-TW',
    source: sourceReason,
    target:
      '關鍵需求是兩個區域在正常運作時都能接受寫入，並可容忍最終一致性及最後寫入者勝出的衝突解決方式。',
    valid: true,
  },
  {
    hash: '7424e510062b6bb2b0b21c0e3c65ed284cfababe8632d432bf7dd477dbd3faf7',
    field: 'learning.reason',
    locale: 'zh-CN',
    source: sourceDop,
    target:
      '在 MREC 模式下，不同区域同时更改同一项目时可能由最后写入的更改胜出。为每个项目指定一个写入所有者区域，可消除导致此类冲突的路径。',
    valid: true,
  },
  {
    hash: '7424e510062b6bb2b0b21c0e3c65ed284cfababe8632d432bf7dd477dbd3faf7',
    field: 'learning.reason',
    locale: 'zh-TW',
    source: sourceDop,
    target:
      '在 MREC 中，不同區域同時變更同一項目時，最後寫入者可能勝出。為每個項目指定一個寫入擁有區域，即可排除導致此類衝突的途徑。',
    valid: true,
  },
] as const;

test('the v2 and DOP inventory leaves retain LWW semantics in both Chinese locales', () => {
  expect(bindings).toHaveLength(8);
  for (const binding of bindings) {
    const check = () =>
      assertNativeLanguage(
        binding.source,
        binding.target,
        binding.locale as Locale,
        `${binding.hash}:${binding.field}`,
      );
    if (binding.valid) expect(check).not.toThrow();
    else expect(check).toThrow('last-writer');
  }
});
