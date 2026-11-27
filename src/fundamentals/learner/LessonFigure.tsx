import lessonFigures from '../delivery/lesson-figures.json' with { type: 'json' };

const figures = new Map(Object.entries(lessonFigures));

export function LessonFigure({ stepId }: { stepId: string }) {
  const figure = figures.get(stepId);
  if (!figure) return null;
  return (
    <figure className="lesson-figure" lang="en">
      <a href={figure.url} target="_blank" rel="noreferrer">
        <img
          src={figure.url}
          alt={figure.alt}
          width={figure.width}
          height={figure.height}
          decoding="async"
        />
      </a>
    </figure>
  );
}
