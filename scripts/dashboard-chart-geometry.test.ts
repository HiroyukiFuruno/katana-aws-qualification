import { expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import {
  boxPositions,
  bubbleRadius,
  donutSegments,
  radarCoordinates,
  stackedWidths,
} from '../src/dashboard/visual/geometry';
import { query, records } from './dashboard-fixture';

test('stacked widths are proportional to counts or normalized percentages, never pixels as counts', () => {
  expect(stackedWidths(3, 1, 200, 10, false)).toEqual({ correct: 60, incorrect: 20 });
  expect(stackedWidths(3, 1, 200, 10, true)).toEqual({ correct: 150, incorrect: 50 });
  expect(stackedWidths(0, 0, 200, 0, true)).toEqual({ correct: 0, incorrect: 0 });
});
test('bubble area is proportional to duration and donut segments cover the actual total', () => {
  expect(bubbleRadius(25, 100)).toBe(11);
  expect(bubbleRadius(100, 100)).toBe(22);
  expect(bubbleRadius(null, 100)).toBe(0);
  expect(donutSegments([3, 1])).toEqual([
    { fraction: 0.75, offset: 0 },
    { fraction: 0.25, offset: 0.75 },
  ]);
});
test('box plot uses actual interpolated duration quantiles, and radar uses fixed 0-100% radius', () => {
  const duration = aggregateDashboard(records, query).duration;
  const positions = boxPositions(duration, 600);
  expect(positions).toEqual({ minimum: 0, lower: 20, median: 75, upper: 250, maximum: 600 });
  expect(radarCoordinates([0.5, 1, 0], 100)[0]).toEqual([120, 70]);
});
