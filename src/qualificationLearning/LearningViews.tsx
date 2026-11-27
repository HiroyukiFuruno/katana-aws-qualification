import { termAnchor } from '../glossaryAnchor';
import { type Locale, localePath } from '../locales.ts';
import { messages } from '../messages.ts';
import studyCopy from './copy.json' with { type: 'json' };
import figureIndex from './figures.json' with { type: 'json' };
import type { qualificationLearningRoute } from './routes';
import { StudyCheckpointForm } from './StudyCheckpoint';
import type { StudyFigure, StudyUnit } from './types';

export type LearningRoute = NonNullable<ReturnType<typeof qualificationLearningRoute>>;
const figures: Record<string, StudyFigure> = figureIndex;

function ExamLink({ courseId, locale }: { courseId: string; locale: Locale }) {
  return <a href={`${localePath(locale, `study/${courseId}`)}?mode=exam`}>{messages[locale].exam}</a>;
}

export function LearningDirectory({ route, locale }: { route: LearningRoute; locale: Locale }) {
  return (
    <main className="shell qualification-lesson" id="main">
      <h1>{route.course.title}</h1>
      <p>{route.course.description}</p>
      {route.course.examStatus && <p className="notice">{route.course.examStatus}</p>}
      <div className="entry-grid study-paths">
        {Object.entries(route.course.units).map(([id, unit]) => (
          <a key={id} className="entry-card" href={localePath(locale, `${route.page}/${id}`)}>
            <h2>{unit.title}</h2>
            <p>{unit.objective}</p>
          </a>
        ))}
      </div>
      <ExamLink courseId={route.courseId} locale={locale} />
    </main>
  );
}

export function LearningArticle({
  route,
  unit,
  locale,
  interactive = false,
}: {
  route: LearningRoute;
  unit: StudyUnit;
  locale: Locale;
  interactive?: boolean;
}) {
  const copy = studyCopy[locale];
  const unitIds = Object.keys(route.course.units);
  const nextUnitId = unitIds[unitIds.indexOf(unit.id) + 1];
  return (
    <main className="shell qualification-lesson" id="main">
      <article>
        <header>
          <a href={localePath(locale, route.page)}>{copy.back}</a>
          <h1>{unit.title}</h1>
          <p>{unit.objective}</p>
        </header>
        {unit.sections.map((section) => {
          const figure = section.figureId && figures[section.figureId];
          if (section.figureId && !figure) throw new Error(`Unknown study figure: ${section.figureId}`);
          return (
            <section key={section.id} aria-labelledby={section.id}>
              <h2 id={section.id}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {figure && (
                <figure lang="en" className="qualification-figure" data-figure={section.figureId}>
                  <img src={figure.src} alt={figure.alt} width={figure.width} height={figure.height} />
                  <figcaption lang={locale}>
                    <a href={figure.src} target="_blank" rel="noreferrer">
                      {copy.openDiagram}
                    </a>
                  </figcaption>
                </figure>
              )}
              <details>
                <summary>{copy.sources}</summary>
                <ul>
                  {section.sources.map(({ label, url }) => (
                    <li key={url}>
                      <a href={url} hrefLang="ja">
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          );
        })}
        <section aria-labelledby="qualification-checkpoint-title">
          <h2 id="qualification-checkpoint-title">{copy.checkpoints}</h2>
          {interactive ? (
            unit.checkpoints.map((question) => (
              <StudyCheckpointForm key={question.id} question={question} />
            ))
          ) : (
            <ol>
              {unit.checkpoints.map(({ id, prompt }) => (
                <li key={id}>{prompt}</li>
              ))}
            </ol>
          )}
        </section>
        <details className="qualification-glossary">
          <summary>{messages[locale].glossary}</summary>
          <ul>
            {unit.glossaryTerms.map((term) => (
              <li key={term}>
                <a href={`${localePath(locale, 'glossary')}#${termAnchor(term)}`}>{term}</a>
              </li>
            ))}
          </ul>
        </details>
        <nav aria-label={unit.title} className="qualification-related">
          {unit.prerequisites.map(({ title, slug }) => (
            <a key={slug} href={localePath(locale, `study/fundamentals/${slug}`)}>
              {title}
            </a>
          ))}
          {nextUnitId ? (
            <a href={localePath(locale, `${route.page}/${nextUnitId}`)}>
              {route.course.units[nextUnitId].title}
            </a>
          ) : (
            <ExamLink courseId={route.courseId} locale={locale} />
          )}
        </nav>
      </article>
    </main>
  );
}
