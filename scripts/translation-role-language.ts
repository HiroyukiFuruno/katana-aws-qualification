import assert from 'node:assert/strict';
import type { Locale } from '../src/locales';

const roleTerms: Partial<Record<Locale, { expression: RegExp; issue: string }>> = {
  'zh-TW': {
    expression: /引受\s*(?:(?:動作|IAM)\s*)?角色/gu,
    issue: 'Traditional Chinese role terminology',
  },
  fr: {
    expression: /(?<![\p{L}\p{N}_])assumption\s+(?:du|de|des)\s+rôles?\b/giu,
    issue: 'French role assumption terminology',
  },
};
const frenchSoftwareServiceAnchor = /(?:AWS\s*Glue|Glue\s+Data\s+Catalog|Athena|Iceberg)/iu;
const frenchSoftwareOperationAnchor =
  /(?:catalog(?:ue)?|locking|lock|commit|コミット|ロック|カタログ)/iu;
const frenchHumanWriter = /(?<![\p{L}\p{N}_])écrivain(?:e|s|es)?(?![\p{L}\p{N}_])/giu;

export function assertRoleLanguage(source: string, translated: string, locale: Locale, context: string) {
  const rule = roleTerms[locale];
  if (!rule) return;
  // 原文で指定されたラベルや識別子の表記は保持する。
  for (const [phrase] of translated.matchAll(rule.expression))
    assert(source.includes(phrase), `${context}: ${rule.issue}`);
  const hasFrenchSoftwareContext =
    (frenchSoftwareServiceAnchor.test(source) && frenchSoftwareOperationAnchor.test(source)) ||
    (/(?:commit|コミット)/iu.test(source) &&
      /(?:locking|lock|catalog(?:ue)?|ロック|カタログ)/iu.test(source));
  if (locale === 'fr' && hasFrenchSoftwareContext) {
    const normalizedSource = source.normalize('NFC');
    for (const [phrase] of translated.normalize('NFC').matchAll(frenchHumanWriter))
      if (!normalizedSource.includes(phrase))
        assert.fail(`${context}: French software writer terminology`);
  }
}
