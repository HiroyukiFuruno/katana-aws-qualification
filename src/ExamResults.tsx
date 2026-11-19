import { ExamFormatPicker } from './ExamFormatPicker';
import { LearningNotes } from './LearningNotes';
import type { ExamBlueprint } from './certifications';
import type { Attempt } from './history';
import { examDomainOf, isAnswerComplete, questionKey, type Question } from './questions';
import type { usePreferences } from './preferences';
import type { Message } from './messages';
import { StructuredAnswerReview } from './StructuredAnswer';

type Translate = ReturnType<typeof usePreferences>['t'];

export function ExamResults({
  attempts,
  byKey,
  blueprint,
  available,
  error,
  showAll,
  onShowAll,
  onStart,
  t,
}: {
  attempts: Attempt[];
  byKey: Map<string, Question>;
  blueprint: ExamBlueprint;
  available: boolean;
  error: Message | '';
  showAll: boolean;
  onShowAll: (show: boolean) => void;
  onStart: (count: number) => void;
  t: Translate;
}) {
  const reviewed = attempts.map((attempt) => ({
    attempt,
    item: byKey.get(questionKey({ id: attempt.questionId, revision: attempt.questionRevision })),
  }));
  const scores = new Map<string, { correct: number; total: number }>();
  for (const { attempt, item } of reviewed) {
    const domain = item ? examDomainOf(item) : attempt.category;
    const score = scores.get(domain) ?? { correct: 0, total: 0 };
    score.total += 1;
    if (attempt.isCorrect) score.correct += 1;
    scores.set(domain, score);
  }
  return (
    <section className="card">
      <h2>{t('examResults')}</h2>
      <p className="exam-score">
        {t('score', {
          correct: attempts.filter((attempt) => attempt.isCorrect).length,
          total: attempts.length,
        })}
      </p>
      <p>{t('examGrading')}</p>
      <dl className="domain-scores">
        {[...scores]
          .sort(([first], [second]) => first.localeCompare(second, 'ja'))
          .map(([domain, score]) => (
            <div key={domain}>
              <dt>{domain}</dt>
              <dd>
                {score.correct} / {score.total}
              </dd>
            </div>
          ))}
      </dl>
      <ExamFormatPicker
        blueprint={blueprint}
        available={available}
        onStart={onStart}
        buttonLabel={t('nextExam')}
      />
      <div className="exam-actions">
        <label>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => onShowAll(event.target.checked)}
          />{' '}
          {t('includeCorrect')}
        </label>
      </div>
      {error && <p role="alert">{t(error)}</p>}
      <div className="exam-solutions">
        {reviewed.map(({ attempt, item }, index) => {
          if (!showAll && attempt.isCorrect) return null;
          const answered = item
            ? isAnswerComplete(item, attempt.selected)
            : attempt.selected.filter(Boolean).length === attempt.correct.length;
          return (
            <details key={attempt.questionId}>
              <summary>
                {t('questionNumber', { number: index + 1 })} ·{' '}
                {attempt.isCorrect ? t('correct') : answered ? t('incorrect') : t('unanswered')} ·{' '}
                {item?.title ?? attempt.questionId}
              </summary>
              <p>{item?.prompt}</p>
              {item?.format ? (
                <StructuredAnswerReview question={item} selected={attempt.selected} />
              ) : (
                <p>
                  {t('selected')} {attempt.selected.join('・') || t('none')} ／ {t('correct')}{' '}
                  {attempt.correct.join('・')}
                </p>
              )}
              {item && <LearningNotes question={item} selected={attempt.selected} />}
              {item && !item.format && (
                <ul>
                  {item.choices.map((choice) => (
                    <li key={choice.id}>
                      <strong>
                        {choice.id} {attempt.correct.includes(choice.id) ? t('correct') : t('incorrect')}{' '}
                        · {choice.text}
                      </strong>
                      <br />
                      {choice.explanation}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}
