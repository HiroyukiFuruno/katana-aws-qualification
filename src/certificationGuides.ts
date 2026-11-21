import type { Locale } from './locales';
import type { Message } from './messages';

type CertificationGuide = {
  scope: Message;
  difficulty: number;
  why: Message;
  audience: Message;
  path: string;
};

export const certificationGuides: Record<string, CertificationGuide> = {
  'clf-c02': {
    scope: 'guideClfScope',
    difficulty: 1,
    why: 'guideClfWhy',
    audience: 'guideClfAudience',
    path: 'cloud-practitioner-02',
  },
  'aif-c01': {
    scope: 'guideAifScope',
    difficulty: 2,
    why: 'guideAifWhy',
    audience: 'guideAifAudience',
    path: 'ai-practitioner-01',
  },
  'saa-c03': {
    scope: 'guideSaaScope',
    difficulty: 3,
    why: 'guideSaaWhy',
    audience: 'guideSaaAudience',
    path: 'solutions-architect-associate-03',
  },
  'dva-c03': {
    scope: 'guideDvaScope',
    difficulty: 3,
    why: 'guideDvaWhy',
    audience: 'guideDvaAudience',
    path: 'developer-associate-03',
  },
  'soa-c03': {
    scope: 'guideSoaScope',
    difficulty: 3,
    why: 'guideSoaWhy',
    audience: 'guideSoaAudience',
    path: 'sysops-administrator-associate-03',
  },
  'dea-c01': {
    scope: 'guideDeaScope',
    difficulty: 3,
    why: 'guideDeaWhy',
    audience: 'guideDeaAudience',
    path: 'data-engineer-associate-01',
  },
  'mla-c01': {
    scope: 'guideMlaScope',
    difficulty: 4,
    why: 'guideMlaWhy',
    audience: 'guideMlaAudience',
    path: 'machine-learning-engineer-associate-01',
  },
  'sap-c03': {
    scope: 'guideSapScope',
    difficulty: 5,
    why: 'guideSapWhy',
    audience: 'guideSapAudience',
    path: 'solutions-architect-professional-03',
  },
  'dop-c02': {
    scope: 'guideDopScope',
    difficulty: 5,
    why: 'guideDopWhy',
    audience: 'guideDopAudience',
    path: 'devops-engineer-professional-02',
  },
  'aip-c01': {
    scope: 'guideAipScope',
    difficulty: 5,
    why: 'guideAipWhy',
    audience: 'guideAipAudience',
    path: 'ai-professional-01',
  },
  'scs-c03': {
    scope: 'guideScsScope',
    difficulty: 5,
    why: 'guideScsWhy',
    audience: 'guideScsAudience',
    path: 'security-specialty-03',
  },
  'ans-c01': {
    scope: 'guideAnsScope',
    difficulty: 5,
    why: 'guideAnsWhy',
    audience: 'guideAnsAudience',
    path: 'advanced-networking-specialty-01',
  },
  'ai-business-strategist': {
    scope: 'guideAiBusinessScope',
    difficulty: 3,
    why: 'guideAiBusinessWhy',
    audience: 'guideAiBusinessAudience',
    path: 'ai-business-strategist-01',
  },
};

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
    href: `https://docs.aws.amazon.com/${prefix ? `${prefix}/` : ''}aws-certification/latest/${path}/${path}.html`,
  };
}
