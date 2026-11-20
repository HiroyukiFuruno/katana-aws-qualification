import { useState } from 'react';
import { dashboardChartPageSize, useDashboardDensity } from './DashboardDensity';
import { chartDomain, chartPalette, stackedWidths, type ValuePoint } from './geometry';
import { DashboardPagePicker } from './PagePicker';

export type StackPoint = ValuePoint & { correct: number; incorrect: number };
export function ValueBars({
  points,
  label,
  format,
  percent = false,
  stacked = false,
  paginate = true,
}: {
  points: readonly StackPoint[];
  label: string;
  format: (value: number | null) => string;
  percent?: boolean;
  stacked?: boolean;
  paginate?: boolean;
}) {
  const density = useDashboardDensity();
  const [requested, setRequested] = useState(0);
  const size =
    !paginate || density === 'full' ? Math.max(1, points.length) : dashboardChartPageSize(density);
  const pages = Math.max(1, Math.ceil(points.length / size));
  const page = Math.min(requested, pages - 1);
  const maximum = chartDomain(
    points.map((point) => point.value),
    percent ? 100 : undefined,
  );
  return (
    <>
      <div className="dashboard-viz-bars" role="img" aria-label={label}>
        {points.slice(page * size, (page + 1) * size).map((point) => {
          const segments = stackedWidths(point.correct, point.incorrect, 100, maximum, percent);
          return (
            <div className="dashboard-viz-bar-row" key={point.id}>
              <div className="dashboard-viz-bar-label">
                <span>{point.label}</span>
                <strong>{format(point.value)}</strong>
              </div>
              <div className="dashboard-viz-track">
                {stacked ? (
                  <>
                    <span style={{ width: `${segments.correct}%`, background: chartPalette[0] }} />
                    <span style={{ width: `${segments.incorrect}%`, background: chartPalette[5] }} />
                  </>
                ) : (
                  <span
                    style={{
                      width: `${((point.value ?? 0) / maximum) * 100}%`,
                      background: chartPalette[0],
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <DashboardPagePicker chart page={page} pages={pages} onChange={setRequested} />
    </>
  );
}
