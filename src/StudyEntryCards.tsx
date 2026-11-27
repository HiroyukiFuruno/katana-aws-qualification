import { appliedDirectory, appliedIndexPage } from './applied/routes.ts';
import { type Locale, localePath } from './locales.ts';
import { messages } from './messages.ts';

export function StudyEntryCards({ locale }: { locale: Locale }) {
  const copy = messages[locale];
  const entries = [
    { page: 'study/fundamentals', title: copy.learnFundamentals, description: copy.fundamentalsEntry },
    { page: appliedIndexPage, ...appliedDirectory(locale) },
    { page: 'study/questions', title: copy.learnFromQuestions, description: copy.studyEntry },
  ];
  return (
    <div className="entry-grid study-paths">
      {entries.map(({ page, title, description }) => (
        <a key={page} className="entry-card" href={localePath(locale, page)}>
          <h2>{title}</h2>
          <p>{description}</p>
        </a>
      ))}
    </div>
  );
}
