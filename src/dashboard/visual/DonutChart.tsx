import { chartPalette, donutSegments, type ValuePoint } from './geometry';

export function DonutChart({
  points,
  label,
  format,
}: {
  points: readonly ValuePoint[];
  label: string;
  format: (value: number | null) => string;
}) {
  const values = points.filter((point) => point.value !== null && point.value > 0);
  const segments = donutSegments(values.map((point) => point.value ?? 0));
  return (
    <div className="dashboard-viz-composition">
      <svg viewBox="0 0 180 180" role="img" aria-label={label} className="dashboard-viz-donut">
        {segments.map((segment, index) => (
          <circle
            key={values[index].id}
            cx="90"
            cy="90"
            r="62"
            fill="none"
            stroke={chartPalette[index % chartPalette.length]}
            strokeWidth="22"
            pathLength="1"
            strokeDasharray={`${segment.fraction} ${1 - segment.fraction}`}
            strokeDashoffset={-segment.offset}
            transform="rotate(-90 90 90)"
          >
            <title>{`${values[index].label}: ${format(values[index].value)}`}</title>
          </circle>
        ))}
      </svg>
      <ul className="dashboard-viz-legend">
        {values.map((point, index) => (
          <li key={point.id}>
            <span
              className="dashboard-viz-swatch"
              style={{ background: chartPalette[index % chartPalette.length] }}
            />
            <span>{point.label}</span>
            <strong>{format(point.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
