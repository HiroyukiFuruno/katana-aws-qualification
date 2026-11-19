import { usePreferences } from '../preferences';
import type { FundamentalsUnit } from './types';

export function FundamentalsLesson({ unit }: { unit: FundamentalsUnit }) {
  const { t } = usePreferences();
  return (
    <section className="card fundamentals-lesson">
      <h2>{t('fundamentalsObjective')}</h2>
      <p>{unit.objective}</p>
      <h2>{t('fundamentalsExplanation')}</h2>
      {unit.explanation.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p>
        <strong>{t('fundamentalsExample')}</strong>
        {unit.example}
      </p>
    </section>
  );
}
