import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

export function assertLowRankLanguage(
  source: string,
  translated: string,
  locale: Locale,
  context: string,
) {
  if (locale !== 'pt' || !/\bLoRA\b/u.test(source) || !/低ランク|low[- ]rank/iu.test(source)) return;
  // 数学上のrankと組織の階級を区別し、原文で指定したラベルは保持する。
  for (const [phrase] of translated.matchAll(/\badaptador(?:es)?\s+de\s+baixo\s+escalão\b/giu))
    assert(source.includes(phrase), `${context}: Portuguese LoRA rank terminology`);
}
