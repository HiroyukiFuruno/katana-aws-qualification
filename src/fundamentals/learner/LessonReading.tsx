import { usePreferences } from '../../preferences';
import type { LessonStep } from '../delivery/slideTypes';
import { LessonVisualSummary } from './LessonVisualSummary';
import { lessonFragments } from './lessonFragments';
import './learner-assessment.css';
import { sourceDocumentationUrl } from '../../sourceDocumentationUrl';

export function LessonReading({ step }: { step: LessonStep }) {
  const { t } = usePreferences();
  let previousLabel = '';
  const sources = step.sources.filter(
    (source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index,
  );
  return (
    <article className={`lesson-reading lesson-reading-page-${step.kind}`} aria-label={step.label}>
      <LessonVisualSummary stepId={step.id}>
        {lessonFragments(step).map(({ block, key }) => {
          const label = block.label;
          const showLabel = Boolean(label) && label !== step.label && label !== previousLabel;
          previousLabel = label;
          return (
            <section className={`lesson-reading-block lesson-reading-${block.kind}`} key={key}>
              {showLabel ? <h2>{label}</h2> : null}
              <p>{block.text}</p>
            </section>
          );
        })}
      </LessonVisualSummary>
      {sources.length ? (
        <details className="lesson-reading-sources lesson-related-reading">
          <summary>{t('lessonSources')}</summary>
          <ul>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={sourceDocumentationUrl(source.url)} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
