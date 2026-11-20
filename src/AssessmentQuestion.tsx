import type { AssessmentItem } from './assessmentTypes';
import { skills } from './certifications';
import { usePreferences } from './preferences';

export function AssessmentQuestion({
  item,
  answer,
  position,
  total,
  selectAnswer,
  onBack,
  onNext,
  saving,
}: {
  item: AssessmentItem;
  answer: number | undefined;
  position: number;
  total: number;
  selectAnswer: (choice: number) => void;
  onBack: () => void;
  onNext: () => void;
  saving: boolean;
}) {
  const { t, locale } = usePreferences();
  return (
    <section className="card roadmap-card" aria-busy={saving}>
      <p className="eyebrow">
        {skills[item.skill]} · {position + 1} / {total}
      </p>
      <h2 lang="ja">{item.prompt}</h2>
      {locale !== 'ja' && <p>{t('contentLanguage')}</p>}
      <fieldset disabled={saving}>
        <legend className="sr-only">{t('choices')}</legend>
        {item.options.map((option, index) => (
          <label className="choice choice-wrap" key={option}>
            <input
              type="radio"
              name={item.id}
              checked={answer === index}
              onChange={() => selectAnswer(index)}
            />
            <span lang="ja">{option}</span>
          </label>
        ))}
        <label className="choice choice-wrap">
          <input
            type="radio"
            name={item.id}
            checked={answer === item.options.length}
            onChange={() => selectAnswer(item.options.length)}
          />
          {t('unknown')}
        </label>
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
