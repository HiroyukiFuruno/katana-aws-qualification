import { recommend } from './assessment';
import type { AssessmentItem } from './assessmentTypes';
import { levelMessage } from './certifications';
import { usePreferences } from './preferences';
import { useContent } from './useContent';

export function RoadmapResults({
  items,
  earned,
  answers,
  today,
  onStudy,
  onEdit,
  onRetake,
  saving,
}: {
  items: AssessmentItem[];
  earned: string[];
  answers: Record<string, number>;
  today: string;
  onStudy: (id: string) => void;
  onEdit: () => void;
  onRetake: () => void;
  saving: boolean;
}) {
  const { t, locale } = usePreferences();
  const { content } = useContent();
  return (
    <>
      <section className="card roadmap-card">
        <h2>{t('assessmentResults')}</h2>
        <p className="exam-score">
          {t('score', {
            correct: items.filter((item) => answers[item.id] === item.correct).length,
            total: items.length,
          })}
        </p>
        <details className="exam-solutions">
          <summary>{t('viewAnswers')}</summary>
          <ol className="roadmap-results">
            {items.map((item) => {
              const chosen = answers[item.id];
              const correct = chosen === item.correct;
              const selectedOption = item.options[chosen];
              const answer =
                chosen === item.options.length
                  ? t('unknown')
                  : selectedOption
                    ? selectedOption
                    : t('unanswered');
              return (
                <li key={item.id}>
                  <strong className={correct ? 'good-text' : 'bad-text'}>
                    {correct ? `○ ${t('correct')}` : `× ${t('incorrect')}`}
                  </strong>
                  <p lang={locale}>{item.prompt}</p>
                  <p>
                    {t('yourAnswer')} · {answer}
                  </p>
                  {!correct && (
                    <p>
                      {t('correct')} · {item.options[item.correct]}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </details>
      </section>
      <section className="card roadmap-card">
        <h2>{t('recommended')}</h2>
        <p>{t('recommendedIntro')}</p>
        <ol className="roadmap-results">
          {recommend(earned, answers, today).map(({ cert, gaps, priority }) => (
            <li key={cert.id}>
              <strong>
                {content.certifications[cert.id]?.name ?? cert.name} · {t(levelMessage[cert.level])}
              </strong>{' '}
              <small>
                {cert.id.toUpperCase()}
                {cert.beta ? ` · ${t('beta')}` : ''}
              </small>
              <p>
                {t('studyScope')} · {content.certifications[cert.id]?.focus ?? cert.focus}
              </p>
              <p>
                {gaps.length
                  ? `${t('reviewTopics')} · ${new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(gaps.map((skill) => content.skills[skill]))}`
                  : t('allTopicsCorrect')}
                {priority > 0 && ` · ${t('retirementPriority')}`}
                {cert.retireOn && ` · ${t('retirement', { date: cert.retireOn })}`}
              </p>
              {cert.buildsOn && (
                <p>
                  {t('relatedCerts')} ·{' '}
                  {new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(
                    cert.buildsOn.map((id) => id.toUpperCase()),
                  )}
                </p>
              )}
              {cert.course ? (
                <button type="button" disabled={saving} onClick={() => onStudy(cert.id)}>
                  {t('openCourse')}
                </button>
              ) : (
                <small>{t('coursePending')}</small>
              )}
            </li>
          ))}
        </ol>
        <p>{t('roadmapScope')}</p>
        <div className="exam-actions">
          <button type="button" disabled={saving} onClick={onEdit}>
            {t('editEarned')}
          </button>
          <button type="button" disabled={saving} onClick={onRetake}>
            {t('retakeAssessment')}
          </button>
        </div>
      </section>
    </>
  );
}
