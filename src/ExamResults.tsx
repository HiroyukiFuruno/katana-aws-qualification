import { AccountBenefits } from './auth/AccountBenefits';
import type { ExamBlueprint } from './certifications';
import { ExamFormatPicker } from './ExamFormatPicker';
import { ExamSolution } from './ExamSolution';
import { examLength } from './exam';
import type { Attempt } from './history';
import type { Message } from './messages';
import type { usePreferences } from './preferences';
import { examDomainOf, type Question, questionKey } from './questions';
import { useContent } from './useContent';

type Translate = ReturnType<typeof usePreferences>['t'];

export function ExamResults({
  attempts,
  byKey,
  choiceOrders,
  blueprint,
  available,
  saving,
  error,
  showAll,
  onShowAll,
  onStart,
  t,
}: {
  attempts: Attempt[];
  byKey: Map<string, Question>;
  choiceOrders: Record<string, string[]> | undefined;
  blueprint: ExamBlueprint;
  available: boolean;
  saving: boolean;
  error: Message | '';
  showAll: boolean;
  onShowAll: (show: boolean) => void;
  onStart: (count: number) => void;
  t: Translate;
}) {
  const { content } = useContent();
  const reviewed = attempts.map((attempt) => ({
    attempt,
    item: byKey.get(questionKey({ id: attempt.questionId, revision: attempt.questionRevision })),
  }));
  const scores = new Map<string, { correct: number; total: number }>();
  const domainLabels = new Map<string, string>();
  for (const { attempt, item } of reviewed) {
    const domain = item ? examDomainOf(item) : attempt.category;
    domainLabels.set(
      domain,
      item?.examDomainLabel ?? item?.categoryLabel ?? content.labels[domain] ?? t('unavailableDomain'),
    );
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
      {attempts.length === examLength(blueprint) && (
        <p className="notice">{t('fullMockResultDisclaimer')}</p>
      )}
      <AccountBenefits context="exam" showAction />
      <dl className="domain-scores">
        {[...scores]
          .sort(([first], [second]) => first.localeCompare(second, 'ja'))
          .map(([domain, score]) => (
            <div key={domain}>
              <dt>{domainLabels.get(domain) ?? t('unavailableDomain')}</dt>
              <dd>
                {score.correct} / {score.total}
              </dd>
            </div>
          ))}
      </dl>
      <ExamFormatPicker
        blueprint={blueprint}
        available={available}
        saving={saving}
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
          return (
            <ExamSolution
              key={attempt.questionId}
              attempt={attempt}
              item={item}
              index={index}
              choiceOrder={item ? choiceOrders?.[questionKey(item)] : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
