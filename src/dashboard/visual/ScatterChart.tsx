import type { DashboardCategoryStats } from '../statTypes';
import { bubbleRadius, chartDomain, chartPalette } from './geometry';

export function ScatterChart({
  points,
  label,
  bubble,
  categoryLabel,
}: {
  points: readonly DashboardCategoryStats[];
  label: string;
  bubble: boolean;
  categoryLabel: (point: DashboardCategoryStats) => string;
}) {
  const maximum = chartDomain(points.map((point) => point.answered));
  const durationMaximum = chartDomain(points.map((point) => point.meanDurationMs));
  return (
    <svg viewBox="0 0 320 210" role="img" aria-label={label} className="dashboard-viz-svg">
      <path d="M32 24 V176 H292" className="dashboard-viz-axis" />
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line
            x1="32"
            x2="292"
            y1={176 - fraction * 144}
            y2={176 - fraction * 144}
            className="dashboard-viz-grid"
          />
          <text x="2" y={180 - fraction * 144}>
            {fraction * 100}%
          </text>
        </g>
      ))}
      <text x="32" y="198">
        0
      </text>
      <text x="292" y="198" textAnchor="end">
        {maximum}
      </text>
      {points.map((point, index) => {
        if (point.accuracy === null) return null;
        const x = 32 + (point.answered / maximum) * 260,
          y = 176 - point.accuracy * 144;
        const radius = bubble ? bubbleRadius(point.meanDurationMs, durationMaximum) : 4;
        return (
          <g
            key={JSON.stringify([
              point.certificationId,
              point.category,
              point.sourceVersion,
              point.questionRevision,
            ])}
          >
            <title>{categoryLabel(point)}</title>
            {radius === 0 ? (
              <path
                d={`M${x - 3} ${y}h6 M${x} ${y - 3}v6`}
                stroke={chartPalette[index % chartPalette.length]}
                strokeWidth="2"
              />
            ) : (
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={chartPalette[index % chartPalette.length]}
                fillOpacity={bubble ? 0.5 : 0.9}
                stroke={chartPalette[index % chartPalette.length]}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
