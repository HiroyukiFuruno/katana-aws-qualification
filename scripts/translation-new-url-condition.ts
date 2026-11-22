import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

const newUrl: Partial<Record<Locale, RegExp>> = {
  en: /(?:new|previously uncached)\s+URLs?/iu,
  'zh-CN': /新(?:的)?\s*(?:URL|网址)/iu,
  'zh-TW': /新(?:的)?\s*(?:URL|網址)/iu,
  ko: /(?:새|새로운)\s*URL/iu,
  pt: /nov[ao]s?\s+URLs?|URLs?\s+nov[ao]s?/iu,
  fr: /nouv(?:elles?|eaux?)\s+URL/iu,
  de: /neuen?\s+URLs?/iu,
  es: /nuev[ao]s?\s+URL|URLs?\s+nuev[ao]s?/iu,
  it: /nuov[oi]\s+URL/iu,
};

export function assertNewUrlCondition(
  source: string,
  translated: string,
  locale: Locale,
  context: string,
) {
  if (locale === 'ja' || !/CloudFront/u.test(source) || !/次回公開の新URL/u.test(source)) return;
  assert(newUrl[locale]?.test(translated), `${context}: missing new URL condition`);
}
