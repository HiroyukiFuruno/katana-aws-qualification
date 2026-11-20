import { chartDomain, chartPalette, stackedWidths, type ValuePoint } from './geometry';

export type StackPoint = ValuePoint & { correct: number; incorrect: number };
export function ValueBars({
  points,
  label,
  format,
  percent = false,
  stacked = false,
}: {
  points: readonly StackPoint[];
  label: string;
  format: (value: number | null) => string;
  percent?: boolean;
  stacked?: boolean;
}) {
  const maximum = chartDomain(
    points.map((point) => point.value),
    percent ? 100 : undefined,
  );
  return (
    <div className="dashboard-viz-bars" role="img" aria-label={label}>
      {points.map((point) => {
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
  );
}
