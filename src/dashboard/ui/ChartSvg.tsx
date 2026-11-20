import type { DashboardChart, DashboardMetric } from '../preferenceTypes';
import { BoxPlot, DonutSegments } from './chartGeometry';
import type { DashboardPoint } from './dashboardPoints';

function metricValue(point: DashboardPoint, metric: DashboardMetric) {
  if (metric === 'incorrect') return point.stats.answered - point.stats.correct;
  if (metric === 'accuracy') return (point.stats.accuracy ?? 0) * 100;
  return point.stats[metric] ?? 0;
}
export function ChartSvg({
  chart,
  metric,
  points,
  label,
}: {
  chart: DashboardChart;
  metric: DashboardMetric;
  points: readonly DashboardPoint[];
  label: string;
}) {
  const values = points.map((point) => metricValue(point, metric));
  const max = Math.max(...values.map((item) => Math.abs(item)), 1);
  const x = (index: number) => 44 + (index * 580) / Math.max(points.length, 1);
  const y = (amount: number) => 150 - (Math.max(amount, 0) / max) * 118;
  const coords = values.map((amount, index) => `${x(index)},${y(amount)}`);
  const bars = ['bar', 'stacked', 'histogram', 'heatmap'].includes(chart);
  return (
    <svg
      className={`dashboard-chart dashboard-chart-${chart}`}
      viewBox="0 0 640 180"
      role="img"
      aria-label={label}
    >
      <line x1="36" y1="150" x2="628" y2="150" className="dashboard-axis" />
      {chart === 'line' && <polyline points={coords.join(' ')} className="dashboard-line" />}
      {chart === 'area' && (
        <polygon points={`44,150 ${coords.join(' ')} 624,150`} className="dashboard-area" />
      )}
      {chart === 'radar' && <polygon points={radarCoords(values, max)} className="dashboard-radar" />}
      {(chart === 'donut' || chart === 'ring') && <DonutSegments values={values} />}
      {chart === 'box' && <BoxPlot values={values} />}
      {points.map((point, index) =>
        bars ? (
          <Bar
            key={point.key}
            x={x(index)}
            y={y(values[index])}
            height={150 - y(values[index])}
            chart={chart}
            incorrect={point.stats.answered - point.stats.correct}
          />
        ) : chart === 'donut' || chart === 'ring' || chart === 'box' ? null : (
          <circle
            key={point.key}
            cx={x(index)}
            cy={y(values[index])}
            r={
              chart === 'bubble'
                ? Math.max(4, Math.min(16, (point.stats.meanDurationMs ?? 0) / 1000))
                : 4
            }
            className="dashboard-point"
          />
        ),
      )}
    </svg>
  );
}
function radarCoords(values: number[], max: number) {
  return values
    .map((amount, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(values.length, 1);
      const radius = (Math.max(amount, 0) / max) * 60;
      return `${320 + Math.cos(angle) * radius},${90 + Math.sin(angle) * radius}`;
    })
    .join(' ');
}
function Bar({
  x,
  y,
  height,
  chart,
  incorrect,
}: {
  x: number;
  y: number;
  height: number;
  chart: DashboardChart;
  incorrect: number;
}) {
  const split =
    chart === 'stacked' ? Math.min(height, (incorrect / Math.max(incorrect + height, 1)) * height) : 0;
  return (
    <>
      {chart === 'stacked' && (
        <rect x={x - 10} y={y} width="20" height={split} rx="3" className="dashboard-bar-secondary" />
      )}
      <rect
        x={x - 10}
        y={y + split}
        width="20"
        height={height - split}
        rx="3"
        className="dashboard-bar"
      />
    </>
  );
}
