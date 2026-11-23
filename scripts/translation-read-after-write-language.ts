import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

const readAfterWriteSource = /\bread[- ]after[- ]write\b|書き?込み後(?:の)?読み取り/iu;
const writeAfterReadSource = /\bwrite[- ]after[- ]read\b|読み取り後(?:の)?書き?込み/iu;
const reversedByLocale: Partial<Record<Locale, RegExp>> = {
  en: /\bwrite[- ]after[- ]read\b/iu,
  ja: /読み取り後(?:の)?書き?込み/iu,
  'zh-CN': /读取后(?:的)?写入/iu,
  'zh-TW': /讀取後(?:的)?寫入/iu,
  ko: /읽기\s*후\s*쓰기/iu,
  pt: /(?:gravação|escrita)\s+(?:após|depois\s+da?)\s+leitura/iu,
  fr: /écriture\s+(?:après|apres)\s+lecture/iu,
  de: /Schreiben\s+nach\s+dem\s+Lesen/iu,
  es: /escritura\s+(?:después|despues)\s+(?:de\s+la\s+)?lectura/iu,
  it: /scrittura\s+dopo\s+la\s+lettura/iu,
};
const forwardByLocale: Partial<Record<Locale, RegExp>> = {
  en: /\bread[- ]after[- ]write\b/iu,
  ja: /書き?込み後(?:の)?読み取り/iu,
  'zh-CN': /写入后(?:的)?读取/iu,
  'zh-TW': /寫入後(?:的)?讀取/iu,
  ko: /쓰기\s*후\s*읽기/iu,
  pt: /leitura\s+(?:após|depois\s+da?)\s+(?:gravação|escrita)/iu,
  fr: /lecture\s+(?:après|apres)\s+écriture/iu,
  de: /Lesen\s+nach\s+dem\s+Schreiben/iu,
  es: /lectura\s+(?:después|despues)\s+(?:de\s+la\s+)?escritura/iu,
  it: /lettura\s+dopo\s+la\s+scrittura/iu,
};

export function assertReadAfterWriteLanguage(
  source: string,
  translated: string,
  locale: Locale,
  context: string,
) {
  const normalizedSource = source.normalize('NFC');
  if (!readAfterWriteSource.test(normalizedSource) || writeAfterReadSource.test(normalizedSource))
    return;
  const reversed = reversedByLocale[locale];
  const forward = forwardByLocale[locale];
  if (forward?.test(translated.normalize('NFC'))) return;
  if (reversed)
    assert(!reversed.test(translated.normalize('NFC')), `${context}: read-after-write order reversed`);
}
