import type { DashboardCategoryStats } from '../statTypes';
import { radarCoordinates } from './geometry';

export function canRenderRadar(points: readonly DashboardCategoryStats[]) {
  return (
    points.length >= 3 &&
    points.every(
      (point) =>
        point.answered >= 5 &&
        point.accuracy !== null &&
        point.certificationId === points[0].certificationId &&
        point.sourceVersion === points[0].sourceVersion &&
        point.questionRevision === points[0].questionRevision,
    )
  );
}
export function RadarChart({
  points,
  label,
}: {
  points: readonly DashboardCategoryStats[];
  label: string;
}) {
  const coordinates = (values: readonly number[]) =>
    radarCoordinates(values, 88)
      .map((point) => point.join(','))
      .join(' ');
  const axes = radarCoordinates(
    points.map(() => 1),
    88,
  );
  return (
    <svg
      viewBox="0 0 240 240"
      className="dashboard-viz-svg dashboard-viz-radar"
      role="img"
      aria-label={label}
    >
      {[0.25, 0.5, 0.75, 1].map((value) => (
        <polygon
          key={value}
          points={coordinates(points.map(() => value))}
          className="dashboard-viz-grid"
        />
      ))}
      {axes.map(([x, y], index) => (
        <g key={points[index].category}>
          <line x1="120" y1="120" x2={x} y2={y} className="dashboard-viz-grid" />
          <text x={x} y={y - 5} textAnchor="middle">
            {index + 1}
          </text>
        </g>
      ))}
      <polygon
        points={coordinates(points.map((point) => point.accuracy ?? 0))}
        className="dashboard-viz-radar-value"
      />
    </svg>
  );
}
