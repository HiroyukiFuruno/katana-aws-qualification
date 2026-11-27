import networkFigures from '../delivery/network-figures.json' with { type: 'json' };

const figures = new Map(Object.entries(networkFigures));

export function LessonNetworkFigure({ stepId }: { stepId: string }) {
  const figure = figures.get(stepId);
  if (!figure) return null;
  return (
    <figure className="lesson-network-figure" lang="en">
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
