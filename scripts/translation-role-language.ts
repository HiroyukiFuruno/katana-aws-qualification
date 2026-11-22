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

export function assertRoleLanguage(source: string, translated: string, locale: Locale, context: string) {
  const rule = roleTerms[locale];
  if (!rule) return;
  // 原文で指定されたラベルや識別子の表記は保持する。
  for (const [phrase] of translated.matchAll(rule.expression))
    assert(source.includes(phrase), `${context}: ${rule.issue}`);
}
