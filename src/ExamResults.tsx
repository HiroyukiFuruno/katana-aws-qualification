import { AccountBenefits } from './auth/AccountBenefits';
import type { ExamBlueprint } from './certifications';
import { ExamFormatPicker } from './ExamFormatPicker';
import type { Attempt } from './history';
import { LearningNotes } from './LearningNotes';
import type { Message } from './messages';
import type { usePreferences } from './preferences';
import { examDomainOf, isAnswerComplete, type Question, questionKey } from './questions';
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
  const scores = new Map<string, { correct: number; total: number; label: string; locale?: string }>();
  for (const { attempt, item } of reviewed) {
    const domain = item ? examDomainOf(item) : attempt.category;
    const score = scores.get(domain) ?? {
      correct: 0,
      total: 0,
      label: item?.locale ? item.category : domain,
      locale: item?.locale,
    };
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
      <AccountBenefits context="exam" showAction />
      <dl className="domain-scores">
        {[...scores]
          .sort(([, first], [, second]) => first.label.localeCompare(second.label, first.locale ?? 'ja'))
          .map(([domain, score]) => (
            <div key={domain}>
              <dt lang={score.locale}>{score.label}</dt>
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
                <span lang={item?.locale}>{item?.title ?? attempt.questionId}</span>
              </summary>
              <p lang={item?.locale}>{item?.prompt}</p>
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
                        · <span lang={item.locale}>{choice.text}</span>
                      </strong>
                      <br />
                      <span lang={item.locale}>{choice.explanation}</span>
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
