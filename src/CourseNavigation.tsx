import type { Message } from './messages';
import { usePreferences } from './preferences';

export const coursePages = [
  ['study', 'studyTab', 'learnFromQuestions'],
  ['exam', 'exam', 'exam'],
  ['review', 'reviewTab', 'review'],
  ['settings', 'settings', 'settings'],
] as const;
export type CoursePage = (typeof coursePages)[number][0];

const courseMenuIcons = {
  study: <path d="M12 6v15M3 4h5c2 0 4 1 4 2 0-1 2-2 4-2h5v15h-5c-2 0-4 1-4 2 0-1-2-2-4-2H3z" />,
  exam: (
    <>
      <circle cx="12" cy="14" r="8" />
      <path d="M9 2h6m4 5 2-2m-9 5v4l2 2" />
    </>
  ),
  review: <path d="M3 5v6h6m-6 0a9 9 0 1 1 2 7" />,
  settings: <path d="M4 6h4m4 0h8M4 12h9m4 0h3M4 18h3m4 0h9M8 4v4m9 2v4m-6 2v4" />,
};

export function CourseNavigation({
  page,
  busy,
  onNavigate,
}: {
  page: CoursePage;
  busy: boolean;
  onNavigate: (page: CoursePage) => void;
}) {
  const { t } = usePreferences();
  return (
    <div className="course-nav">
      <nav className="shell" aria-label={t('studyMenu')}>
        {coursePages.map(([id, label]) => (
          <button
            type="button"
            key={id}
            disabled={busy}
            aria-current={page === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {courseMenuIcons[id]}
            </svg>
            {t(label)}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function CourseOverview({
  id,
  name,
  page,
  answerCount,
  rate,
  wrongCount,
  notice,
  hasQuestionTranslations,
}: {
  id: string;
  name: string;
  page: CoursePage;
  answerCount: number;
  rate: string;
  wrongCount: number;
  notice: Message | '';
  hasQuestionTranslations: boolean;
}) {
  const { t, locale } = usePreferences();
  const heading = coursePages.find(([id]) => page === id)?.[2];
  return (
    <>
      <div className="intro">
        <p className="eyebrow">
          {name} · {id.toUpperCase()}
        </p>
        <h1>{heading && t(heading)}</h1>
        {page === 'study' && <p>{t('studyIntro')}</p>}
        {page === 'review' && <p>{t('reviewIntro')}</p>}
      </div>
      {locale !== 'ja' && !hasQuestionTranslations && <p>{t('contentLanguage')}</p>}
      <section className="metrics" aria-label={t('progress')}>
        <div>
          <span>{t('answerCount')}</span>
          <strong>{answerCount}</strong>
        </div>
        <div>
          <span>{t('accuracy')}</span>
          <strong>{rate}</strong>
        </div>
        <div>
          <span>{t('wrongCount')}</span>
          <strong>{wrongCount}</strong>
        </div>
      </section>
      {notice && (
        <p className="notice" role="status">
          {t(notice)}
        </p>
      )}
    </>
  );
}
