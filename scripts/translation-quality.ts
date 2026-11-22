import { AssertionError } from 'node:assert';
import type { Locale } from '../src/locales';
import { assertNativeLanguage } from './content-language-issues.ts';

type Dictionary = Record<string, string>;
const formatKeys = ['examFormatShort', 'examFormatMedium', 'examFormatFull', 'examFormatCustom'];
const unsupportedPromises =
  /free forever|gr[aá]tis (?:para |per )?s(?:empre|iempre)|永久[免無]料|永久免费|永久免費|dauerhaft kostenlos/i;

const periodOnlyInheritance: Partial<Record<Locale, string>> = {
  en: 'Use dashboard date range',
  fr: 'Utiliser la période du tableau de bord',
  de: 'Dashboard-Zeitraum verwenden',
  es: 'Usar el periodo del panel',
  it: 'Usa il periodo della dashboard',
  pt: 'Usar o período do painel',
  ko: '대시보드 기간 사용',
  'zh-CN': '沿用仪表板的时间范围',
  'zh-TW': '沿用儀表板的期間設定',
};

export function translationIssues(
  locale: Locale,
  dictionary: Dictionary,
  sourceDictionary: Dictionary = {},
) {
  const issues: string[] = [];
  for (const [key, value] of Object.entries(dictionary)) {
    const context = `${locale}.${key}`;
    try {
      assertNativeLanguage(sourceDictionary[key] ?? '', value, locale, context);
    } catch (error) {
      if (!(error instanceof AssertionError)) throw error;
      issues.push(error.message);
    }
    if (value !== value.trim()) issues.push(`${context}: surrounding whitespace`);
    if (
      [...value].some((character) => character.charCodeAt(0) < 32 && !'\t\n\r'.includes(character)) ||
      /[\u200b\ufffd]/u.test(value)
    )
      issues.push(`${context}: invalid or invisible character`);
    if (locale !== 'ja' && /[\u3041-\u3096\u30a1-\u30fa]/u.test(value))
      issues.push(`${context}: untranslated Japanese`);
    if (locale !== 'ko' && /\p{Script=Hangul}/u.test(value))
      issues.push(`${context}: unexpected Korean`);
    if (!['ja', 'zh-CN', 'zh-TW'].includes(locale) && /\p{Script=Han}/u.test(value))
      issues.push(`${context}: unexpected CJK text`);
    if (/[{}]/u.test(value.replace(/\{\w+\}/g, ''))) issues.push(`${context}: malformed placeholder`);
  }
  const faq = dictionary.mockFormatAnswer?.toLocaleLowerCase(locale);
  for (const key of formatKeys) {
    const label = dictionary[key]?.toLocaleLowerCase(locale);
    if (!faq || !label || !faq.includes(label))
      issues.push(`${locale}.mockFormatAnswer: missing UI label ${key}`);
  }
  if (unsupportedPromises.test(dictionary.accountBenefitFree ?? ''))
    issues.push(`${locale}.accountBenefitFree: unsupported lifetime pricing promise`);
  if (
    dictionary.dashboardInherit !== undefined &&
    dictionary.dashboardInherit === periodOnlyInheritance[locale]
  )
    issues.push(`${locale}.dashboardInherit: shared filter reset is incorrectly limited to dates`);
  return issues;
}
