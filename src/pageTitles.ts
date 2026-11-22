import type { Locale } from './locales';
import { messages, type Message } from './messages.ts';

const titles: Record<string, Message> = {
  '': 'landingTitle',
  study: 'study',
  'study/fundamentals': 'learnFundamentals',
  'study/questions': 'learnFromQuestions',
  assessment: 'skillsAssessment',
  certifications: 'certGuides',
  glossary: 'glossary',
  privacy: 'privacy',
  login: 'accountSignIn',
  dashboard: 'accountDashboard',
  'auth/callback': 'accountLoading',
};

export function pageTitle(page: string | undefined, locale: Locale, certificationName?: string) {
  const dictionary = messages[locale];
  const key = page === undefined ? undefined : titles[page];
  const title = key ? dictionary[key] : (certificationName ?? dictionary.notFound);
  return `${title} | ${dictionary.siteName}`;
}
