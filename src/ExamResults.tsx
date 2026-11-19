import { ExamFormatPicker } from './ExamFormatPicker';
import { LearningNotes } from './LearningNotes';
import type { ExamBlueprint } from './certifications';
import type { Attempt } from './history';
import { questionKey, type Question } from './questions';
import type { usePreferences } from './preferences';
import type { Message } from './messages';

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
        {[...new Set(attempts.map((attempt) => attempt.category))].sort().map((category) => {
          const items = attempts.filter((attempt) => attempt.category === category);
          return (
            <div key={category}>
              <dt>{category}</dt>
              <dd>
                {items.filter((item) => item.isCorrect).length} / {items.length}
              </dd>
            </div>
          );
        })}
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
        {attempts.map((attempt, index) => {
          if (!showAll && attempt.isCorrect) return null;
          const item = byKey.get(
            questionKey({ id: attempt.questionId, revision: attempt.questionRevision }),
          );
          const answered = attempt.selected.length === attempt.correct.length;
          return (
            <details key={attempt.questionId}>
              <summary>
                {t('questionNumber', { number: index + 1 })} ·{' '}
                {attempt.isCorrect ? t('correct') : answered ? t('incorrect') : t('unanswered')} ·{' '}
                {item?.title ?? attempt.questionId}
              </summary>
              <p>{item?.prompt}</p>
              <p>
                {t('selected')} {attempt.selected.join('・') || t('none')} ／ {t('correct')}{' '}
                {attempt.correct.join('・')}
              </p>
              {item && <LearningNotes question={item} selected={attempt.selected} />}
              {item && (
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
