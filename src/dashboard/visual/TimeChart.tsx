import { chartDomain, type ValuePoint } from './geometry';

export type TimePoint = ValuePoint & { time: number };
export function TimeChart({
  points,
  label,
  area,
  percentage,
  bar = false,
  format,
}: {
  points: readonly TimePoint[];
  label: string;
  area: boolean;
  percentage: boolean;
  bar?: boolean;
  format: (value: number | null) => string;
}) {
  const ordered = [...points].sort((a, b) => a.time - b.time);
  if (!ordered.length) return null;
  const start = ordered[0].time,
    end = ordered.at(-1)?.time ?? start;
  const maximum = chartDomain(
    ordered.map((point) => point.value),
    percentage ? 100 : undefined,
  );
  const x = (time: number) => (start === end ? 160 : 30 + ((time - start) / (end - start)) * 260);
  const y = (value: number) => 160 - (value / maximum) * 130;
  const segments: TimePoint[][] = [];
  let segment: TimePoint[] = [];
  for (const point of ordered) {
    if (point.value === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push(point);
  }
  if (segment.length) segments.push(segment);
  return (
    <div className="dashboard-viz-time">
      <svg viewBox="0 0 320 185" className="dashboard-viz-svg" role="img" aria-label={label}>
        {[0, 0.5, 1].map((fraction) => (
          <g key={fraction}>
            <line
              x1="30"
              x2="290"
              y1={160 - fraction * 130}
              y2={160 - fraction * 130}
              className="dashboard-viz-grid"
            />
            <text x="28" y={155 - fraction * 130} textAnchor="start">
              {format(maximum * fraction)}
            </text>
          </g>
        ))}
        {!bar &&
          segments.map((values) => {
            const coordinates = values
              .map((point) => `${x(point.time)},${y(point.value ?? 0)}`)
              .join(' ');
            return area ? (
              <polygon
                key={values[0].id}
                points={`${x(values[0].time)},160 ${coordinates} ${x(values.at(-1)?.time ?? start)},160`}
                className="dashboard-viz-area"
              />
            ) : (
              <polyline key={values[0].id} points={coordinates} className="dashboard-viz-line" />
            );
          })}
        {ordered.map((point) =>
          point.value === null ? null : bar ? (
            <rect
              key={point.id}
              x={x(point.time) - Math.min(6, 100 / ordered.length)}
              y={y(point.value)}
              width={Math.min(12, 200 / ordered.length)}
              height={160 - y(point.value)}
              className="dashboard-viz-dot"
            >
              <title>{`${point.label}: ${format(point.value)}`}</title>
            </rect>
          ) : (
            <circle
              key={point.id}
              cx={x(point.time)}
              cy={y(point.value)}
              r="3"
              className="dashboard-viz-dot"
            >
              <title>{`${point.label}: ${format(point.value)}`}</title>
            </circle>
          ),
        )}
      </svg>
      <div className="dashboard-viz-time-labels">
        <span>{ordered[0].label}</span>
        <span>{ordered.at(-1)?.label}</span>
      </div>
    </div>
  );
}
