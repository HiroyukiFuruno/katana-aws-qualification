import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

const japaneseMrec = /(?:複数リージョン|マルチリージョン)(?:の)?結果整合性/iu;
const englishMrec = /\bmulti[- ]Region\s+eventual\s+consistency\b/iu;
const mrecIdentifier = /\bMREC\b/iu;

const eventualByLocale: Record<Locale, RegExp> = {
  en: /\beventual\s+consistency\b|\bmulti[- ]Region\s+eventual\s+consistency\b/iu,
  ja: /結果整合性/iu,
  'zh-CN': /最终一致性/iu,
  'zh-TW': /最終一致性/iu,
  ko: /(?:최종(?:적)?|결과적)\s*일관성/iu,
  pt: /consistência\s+eventual/iu,
  fr: /cohérence\s+(?:éventuelle|à\s+terme)/iu,
  de: /\b(?:multi[- ]Region\s+eventual\s+consistency|eventual\s+consistency)\b|(?:letztendlich\p{L}*|eventuell\p{L}*)\s+Konsistenz|letztendlich\s+konsistente(?:\s+Replikate)?/iu,
  es: /(?:coherencia|consistencia)\s+(?:eventual|final)/iu,
  it: /(?:consistenza|coerenza)\s+(?:eventuale|finale)/iu,
};

function isMrecSource(source: string) {
  const normalized = source.normalize('NFC');
  return (
    japaneseMrec.test(normalized) || englishMrec.test(normalized) || mrecIdentifier.test(normalized)
  );
}

export function assertMrecLanguage(source: string, translated: string, locale: Locale, context: string) {
  if (!isMrecSource(source)) return;
  const normalized = translated.normalize('NFC');
  if (mrecIdentifier.test(normalized)) return;
  assert(eventualByLocale[locale].test(normalized), `${context}: MREC eventual consistency terminology`);
}
