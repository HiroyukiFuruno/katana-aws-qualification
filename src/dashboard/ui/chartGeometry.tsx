export function DonutSegments({ values }: { values: number[] }) {
  const total = values.reduce((sum, value) => sum + Math.max(value, 0), 0) || 1;
  let offset = 0;
  return (
    <>
      {values.map((value) => {
        const percent = (Math.max(value, 0) / total) * 100;
        const segment = (
          <circle
            key={`segment-${value}-${offset}`}
            cx="90"
            cy="90"
            r="58"
            pathLength="100"
            strokeDasharray={`${percent} ${100 - percent}`}
            strokeDashoffset={-offset}
            className="dashboard-donut-segment"
          />
        );
        offset += percent;
        return segment;
      })}
    </>
  );
}
export function BoxPlot({ values }: { values: number[] }) {
  const ordered = [...values].sort((a, b) => a - b);
  const q = (ratio: number) =>
    ordered[Math.min(ordered.length - 1, Math.floor((ordered.length - 1) * ratio))] ?? 0;
  return (
    <g className="dashboard-box">
      <line x1="320" x2="320" y1={150 - q(1)} y2={150 - q(0)} />
      <rect x="290" width="60" y={150 - q(0.75)} height={Math.max(2, q(0.75) - q(0.25))} />
      <line x1="290" x2="350" y1={150 - q(0.5)} y2={150 - q(0.5)} />
    </g>
  );
}
