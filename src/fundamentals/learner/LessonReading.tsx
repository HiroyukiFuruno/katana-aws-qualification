import { Fragment } from 'react';
import { imageSlot } from '../../images/catalog';
import { ImageSlot } from '../../images/ImageSlot';
import { usePreferences } from '../../preferences';
import type { LessonStep } from '../delivery/slideTypes';
import { LessonGlossaryLinks } from './LessonGlossaryLinks';
import { LessonVisualSummary } from './LessonVisualSummary';
import { lessonFragments } from './lessonFragments';
import './learner-assessment.css';
import { localizedDocumentationSource } from '../../sourceDocumentationUrl';

export function LessonReading({ step }: { step: LessonStep }) {
  const { locale, t } = usePreferences();
  let previousLabel = '';
  const sources = step.sources
    .map((source) => localizedDocumentationSource(source, locale))
    .filter(
      (source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index,
    );
  return (
    <article className={`lesson-reading lesson-reading-page-${step.kind}`} aria-label={step.label}>
      <LessonVisualSummary stepId={step.id}>
        {lessonFragments(step).map(({ block, key }, index) => {
          const label = block.label;
          const showLabel = Boolean(label) && label !== step.label && label !== previousLabel;
          previousLabel = label;
          return (
            <Fragment key={key}>
              <section className={`lesson-reading-block lesson-reading-${block.kind}`}>
                {showLabel ? <h2>{label}</h2> : null}
                <p>{block.text}</p>
              </section>
              {index === 0 && step.kind === 'reading' ? (
                <ImageSlot id={imageSlot('fundamentals', step.id)} locale={locale} />
              ) : null}
            </Fragment>
          );
        })}
      </LessonVisualSummary>
      <LessonGlossaryLinks stepId={step.id} />
      {sources.length ? (
        <details className="lesson-reading-sources lesson-related-reading">
          <summary>{t('lessonSources')}</summary>
          <ul>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} hrefLang={source.locale} target="_blank" rel="noreferrer">
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
