import type { DashboardDuration } from '../statTypes';
import { boxPositions } from './geometry';

export function BoxChart({ duration, label }: { duration: DashboardDuration; label: string }) {
  const position = boxPositions(duration, 260);
  if (!position) return null;
  const x = (value: number) => value + 30;
  return (
    <svg
      viewBox="0 0 320 100"
      className="dashboard-viz-svg dashboard-viz-box"
      role="img"
      aria-label={label}
    >
      <line
        x1={x(position.minimum)}
        x2={x(position.maximum)}
        y1="50"
        y2="50"
        className="dashboard-viz-axis"
      />
      <line
        x1={x(position.minimum)}
        x2={x(position.minimum)}
        y1="30"
        y2="70"
        className="dashboard-viz-axis"
      />
      <line
        x1={x(position.maximum)}
        x2={x(position.maximum)}
        y1="30"
        y2="70"
        className="dashboard-viz-axis"
      />
      <rect
        x={x(position.lower)}
        y="24"
        width={Math.max(position.upper - position.lower, 1)}
        height="52"
        className="dashboard-viz-quartiles"
      />
      <line
        x1={x(position.median)}
        x2={x(position.median)}
        y1="24"
        y2="76"
        className="dashboard-viz-median"
      />
    </svg>
  );
}
