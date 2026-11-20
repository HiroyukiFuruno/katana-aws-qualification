import type { DashboardDuration } from '../statTypes';

export type ValuePoint = { id: string; label: string; value: number | null };
export const chartPalette = ['#2878dc', '#087f8c', '#b57508', '#ae4c97', '#6c5bd1', '#b95140'];

export function chartDomain(values: readonly (number | null)[], fixed?: number) {
  return fixed ?? values.reduce<number>((maximum, value) => Math.max(maximum, value ?? 0), 1);
}
export function stackedWidths(
  correct: number,
  incorrect: number,
  pixels: number,
  maximum: number,
  normalized: boolean,
) {
  const denominator = normalized ? correct + incorrect : maximum;
  const scale = denominator === 0 ? 0 : pixels / denominator;
  return { correct: correct * scale, incorrect: incorrect * scale };
}
export function bubbleRadius(duration: number | null, maximum: number, radius = 22) {
  return duration === null || maximum <= 0 ? 0 : Math.sqrt(duration / maximum) * radius;
}
export function radarCoordinates(values: readonly number[], radius: number, center = 120) {
  return values.map((value, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length;
    return [
      center + Math.cos(angle) * radius * value,
      center + Math.sin(angle) * radius * value,
    ] as const;
  });
}
export function donutSegments(values: readonly number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  let offset = 0;
  return values.map((value) => {
    const fraction = total ? value / total : 0;
    const segment = { fraction, offset };
    offset += fraction;
    return segment;
  });
}
export function boxPositions(duration: DashboardDuration, width: number) {
  if (
    duration.count === 0 ||
    duration.min === null ||
    duration.max === null ||
    duration.p25 === null ||
    duration.p50 === null ||
    duration.p75 === null
  )
    return null;
  const scale = (value: number) =>
    duration.max === duration.min
      ? width / 2
      : ((value - (duration.min ?? 0)) / ((duration.max ?? 1) - (duration.min ?? 0))) * width;
  return {
    minimum: scale(duration.min),
    lower: scale(duration.p25),
    median: scale(duration.p50),
    upper: scale(duration.p75),
    maximum: scale(duration.max),
  };
}
