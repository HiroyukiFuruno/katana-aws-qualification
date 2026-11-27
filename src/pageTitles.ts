import { appliedPageMetadata } from './applied/routes.ts';
import type { Locale } from './locales';
import { type Message, messages } from './messages.ts';

const titles: Record<string, Message> = {
  '': 'landingTitle',
  study: 'study',
  'study/fundamentals': 'learnFundamentals',
  'study/questions': 'learnFromQuestions',
  assessment: 'skillsAssessment',
  certifications: 'certGuides',
  'certifications/overview': 'certOverviewSearchTitle',
  glossary: 'glossary',
  privacy: 'privacy',
  login: 'accountSignIn',
  dashboard: 'accountDashboard',
  'auth/callback': 'accountLoading',
};

export function pageTitle(page: string | undefined, locale: Locale, certificationName?: string) {
  const dictionary = messages[locale];
  const key = page === undefined ? undefined : titles[page];
  const applied = page === undefined ? undefined : appliedPageMetadata(locale, page);
  const title = key ? dictionary[key] : (applied?.title ?? certificationName ?? dictionary.notFound);
  return `${title} | ${dictionary.siteName}`;
}
