import { usePreferences } from '../../preferences';
import type { DeliveryQuestion, DeliveryUnitAsset } from '../delivery/artifactTypes';
import './lesson-related.css';

export function LessonRelatedReading({
  asset,
  question,
}: {
  asset: DeliveryUnitAsset;
  question: DeliveryQuestion;
}) {
  const { t } = usePreferences();
  const reading = asset.steps.filter(
    (step) =>
      step.kind !== 'checkpoint' && step.kind !== 'final' && step.sectionId === question.sectionId,
  );
  const sources = reading
    .flatMap((step) => step.sources)
    .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index);
  if (!reading.length) throw new Error('The assessment has no related reading section.');
  return (
    <details className="lesson-related-reading">
      <summary>{t('fundamentalsReadRelatedLesson')}</summary>
      <div className="lesson-related-content">
        {reading.map((step) => (
          <section key={step.id}>
            <h3>{step.label}</h3>
            {step.blocks.map((block) => (
              <p key={block.contentRef}>{block.text}</p>
            ))}
          </section>
        ))}
        <ul>
          {sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
