import sourceContent from './content/ja.json' with { type: 'json' };
import type { Locale } from './locales';
import { sourceDocumentationUrl } from './sourceDocumentationUrl';

type CertificationGuide = {
  scope: string;
  difficulty: number;
  why: string;
  audience: string;
  path: string;
};

export const certificationGuides: Record<string, CertificationGuide> = sourceContent.guides;

// AWS sometimes serves English content under a localized URL. These editions
// were checked against the language of the guide itself.
const guideLocales: Readonly<Record<string, readonly Locale[]>> = {
  'cloud-practitioner-02': ['ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it'],
  'ai-practitioner-01': ['ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'de', 'es', 'it'],
  'solutions-architect-associate-03': ['ja', 'zh-CN', 'zh-TW', 'ko', 'pt', 'fr', 'es', 'it'],
  'developer-associate-03': ['ja', 'zh-CN', 'ko', 'pt', 'es'],
  'data-engineer-associate-01': ['ja', 'zh-CN', 'ko'],
  'machine-learning-engineer-associate-01': ['ja', 'zh-CN', 'ko'],
  'solutions-architect-professional-03': ['zh-CN'],
  'devops-engineer-professional-02': ['ja', 'zh-CN', 'ko'],
  'ai-professional-01': ['ja', 'zh-CN', 'ko'],
  'security-specialty-03': ['ja', 'zh-CN', 'ko', 'pt', 'es'],
  'advanced-networking-specialty-01': ['ja', 'zh-CN', 'ko'],
  'ai-business-strategist-01': ['ja', 'zh-CN', 'ko', 'pt', 'es'],
  'sysops-administrator-associate-03': ['ja', 'zh-CN', 'ko'],
};

const awsDocsLocales: Partial<Record<Locale, string>> = {
  ja: 'ja_jp',
  'zh-CN': 'zh_cn',
  'zh-TW': 'zh_tw',
  ko: 'ko_kr',
  pt: 'pt_br',
  fr: 'fr_fr',
  de: 'de_de',
  es: 'es_es',
  it: 'it_it',
};

export function officialGuideLink(path: string, locale: Locale) {
  const language = guideLocales[path]?.includes(locale) ? locale : 'en';
  const prefix = awsDocsLocales[language];
  return {
    language,
    href: sourceDocumentationUrl(
      `https://docs.aws.amazon.com/${prefix ? `${prefix}/` : ''}aws-certification/latest/${path}/${path}.html`,
    ),
  };
}
