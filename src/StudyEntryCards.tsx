import { type Locale, localePath } from './locales.ts';
import { messages } from './messages.ts';

const entries = [
  {
    page: 'study/fundamentals',
    title: 'learnFundamentals',
    description: 'fundamentalsEntry',
  },
  {
    page: 'study/questions',
    title: 'learnFromQuestions',
    description: 'studyEntry',
  },
] as const;

export function StudyEntryCards({ locale }: { locale: Locale }) {
  const copy = messages[locale];
  return (
    <div className="entry-grid study-paths">
      {entries.map(({ page, title, description }) => (
        <a key={page} className="entry-card" href={localePath(locale, page)}>
          <h2>{copy[title]}</h2>
          <p>{copy[description]}</p>
        </a>
      ))}
    </div>
  );
}
