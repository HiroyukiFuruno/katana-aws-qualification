import { usePreferences } from '../../preferences';
import type { LessonStep } from '../delivery/slideTypes';
import { lessonFragments } from './lessonFragments';
import './learner-assessment.css';

export function LessonReading({ step }: { step: LessonStep }) {
  const { t } = usePreferences();
  let previousLabel = '';
  const sources = step.sources.filter(
    (source, index, all) => all.findIndex((candidate) => candidate.url === source.url) === index,
  );
  return (
    <article className="lesson-reading" aria-label={step.label}>
      {lessonFragments(step).map(({ block, key }) => {
        const showLabel =
          Boolean(block.label) && block.label !== step.label && block.label !== previousLabel;
        previousLabel = block.label;
        return (
          <section className={`lesson-reading-block lesson-reading-${block.kind}`} key={key}>
            {showLabel ? <h2>{block.label}</h2> : null}
            <p>{block.text}</p>
          </section>
        );
      })}
      {sources.length ? (
        <section className="lesson-reading-sources" aria-labelledby="lesson-sources-title">
          <h2 id="lesson-sources-title">{t('lessonSources')}</h2>
          <ul>
            {sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
