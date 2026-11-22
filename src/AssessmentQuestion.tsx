import type { AssessmentItem } from './assessmentTypes';
import { usePreferences } from './preferences';

export function AssessmentQuestion({
  item,
  skillLabel,
  answer,
  position,
  total,
  choiceOrder,
  selectAnswer,
  onBack,
  onNext,
  saving,
}: {
  item: AssessmentItem;
  skillLabel: string;
  answer: number | undefined;
  position: number;
  total: number;
  choiceOrder: number[];
  selectAnswer: (choice: number) => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}) {
  const { locale, t } = usePreferences();
  return (
    <section className="card roadmap-card" aria-busy={saving}>
      <p className="eyebrow">
        {skillLabel} · {position + 1} / {total}
      </p>
      <h2 lang={locale}>{item.prompt}</h2>
      {locale !== 'ja' && <p>{t('contentLanguage')}</p>}
      <fieldset disabled={saving}>
        <legend className="sr-only">{t('choices')}</legend>
        {choiceOrder.map((index) => {
          const option = index === item.options.length ? t('unknown') : item.options[index];
          return (
            <label className="choice choice-wrap" key={option}>
              <input
                type="radio"
                name={item.id}
                value={index}
                checked={answer === index}
                onChange={() => selectAnswer(index)}
              />
              <span lang={locale}>{option}</span>
            </label>
          );
        })}
      </fieldset>
      <div className="exam-actions">
        <button type="button" disabled={saving} onClick={onBack}>
          {t('back')}
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving || answer === undefined}
          onClick={onNext}
        >
          {position === total - 1 ? t('viewAssessment') : t('next')}
        </button>
      </div>
    </section>
  );
}
