import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

const japaneseLww = /(?:最終書き?込み優先|最後の?書き?込み(?:が勝つ|優先))/u;
const englishLww = /\b(?:last[- ]writer[- ]wins?|LWW)\b/iu;
const lastWriterByLocale = {
  'zh-CN':
    /\b(?:LWW|last[- ]writer[- ]wins)\b|(?:最后写入者(?:可能)?(?:优先|胜出)|最后写入(?:的更改)?胜出|最后写入者为准)/iu,
  'zh-TW':
    /\b(?:LWW|last[- ]writer[- ]wins)\b|(?:最後寫入者(?:可能)?(?:優先|勝出)|最後寫入(?:的變更)?勝出|最後寫入者為準)/iu,
} as const;

function isLwwSource(source: string) {
  const normalized = source.normalize('NFC');
  return japaneseLww.test(normalized) || englishLww.test(normalized);
}

export function assertConflictLanguage(
  source: string,
  translated: string,
  locale: Locale,
  context: string,
) {
  if ((locale !== 'zh-CN' && locale !== 'zh-TW') || !isLwwSource(source)) return;
  const normalized = translated.normalize('NFC');
  assert(lastWriterByLocale[locale].test(normalized), `${context}: last-writer-wins terminology`);
}
