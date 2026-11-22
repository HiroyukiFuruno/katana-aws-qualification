import { usePreferences } from '../preferences';
import { FundamentalsSection } from './FundamentalsSection';
import type { FundamentalsUnit } from './types';

export function FundamentalsLesson({ unit, sectionId }: { unit: FundamentalsUnit; sectionId?: string }) {
  const { t } = usePreferences();
  if (unit.sections?.length)
    return (
      <div className="fundamentals-reading">
        {!sectionId && (
          <section className="card fundamentals-objectives">
            <h2>{t('fundamentalsObjective')}</h2>
            <p>{unit.objective}</p>
            <ul>
              {unit.learningObjectives?.map((objective) => (
                <li key={objective.id}>{objective.text}</li>
              ))}
            </ul>
            <nav aria-label={t('fundamentalsReadingContents')}>
              <ol>
                {unit.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#lesson-${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </section>
        )}
        {unit.sections
          .filter((section) => !sectionId || section.id === sectionId)
          .map((section) => (
            <FundamentalsSection key={section.id} section={section} />
          ))}
      </div>
    );
  return (
    <section className="card fundamentals-lesson">
      <h2>{t('fundamentalsObjective')}</h2>
      <p>{unit.objective}</p>
      <h2>{t('fundamentalsExplanation')}</h2>
      {unit.explanation.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p>
        <strong>{t('fundamentalsExample')}</strong> {unit.example}
      </p>
    </section>
  );
}
