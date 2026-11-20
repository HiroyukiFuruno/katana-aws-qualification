import { describe, expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { base, query, records } from './dashboard-fixture';

describe('dashboard verified records aggregation', () => {
  test('uses weighted totals, actual zero durations and interpolated quantiles', () => {
    const result = aggregateDashboard(records, query);
    expect(result.total).toEqual({
      answered: 6,
      correct: 3,
      accuracy: 0.5,
      durationMs: 106000,
      meanDurationMs: 106000 / 6,
    });
    expect(result.duration).toMatchObject({
      count: 6,
      min: 0,
      p05: 250,
      p25: 2000,
      p50: 7500,
      p75: 25000,
      p95: 52500,
      max: 60000,
    });
    expect(result.duration.bins.map((bin) => bin.count)).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);
    expect(result.daily).toEqual([{ date: '2026-11-20', ...result.total }]);
  });

  test('keeps revisions separate and selects latest scoped non-exam errors', () => {
    const result = aggregateDashboard(records, query);
    expect(result.groups.categories).toHaveLength(4);
    expect(result.review.map((row) => [row.questionId, row.sourceVersion])).toEqual([['q1', 'v2']]);
    const beforeCorrection = aggregateDashboard(records, {
      ...query,
      range: { ...query.range, to: '2026-11-19T15:00:30Z' },
    });
    expect(beforeCorrection.review.map((row) => row.questionId)).toEqual(['q1', 'q2']);
    expect(result.facets.certificationIds).toEqual(['aif-c01', 'saa-c03']);
  });

  test('filters half-open UTC range and preserves full exam stats apart from subset', () => {
    const subset = aggregateDashboard(records, { ...query, categories: ['ai'] });
    expect(subset.total.answered).toBe(1);
    expect(subset.exams[0]).toMatchObject({
      submittedAt: null,
      startedAt: null,
      stats: { answered: 1, correct: 0 },
      allAnswers: { answered: 2, correct: 1 },
    });
    const empty = aggregateDashboard(records, {
      ...query,
      range: { ...query.range, to: base.answeredAt },
    });
    expect(empty.total.accuracy).toBeNull();
    expect(empty.duration.p50).toBeNull();
    expect(empty.exams).toEqual([]);
    expect(empty.facets.certificationIds).toEqual(['aif-c01', 'saa-c03']);
  });

  test('applies each semantic dimension without inferring missing metadata', () => {
    expect(aggregateDashboard(records, { ...query, polarities: ['incorrect'] }).total.answered).toBe(0);
    expect(
      aggregateDashboard(records, { ...query, unitIds: ['fundamentals.cloud-concepts'] }).total.answered,
    ).toBe(0);
    expect(
      aggregateDashboard(records, {
        ...query,
        revisions: [{ sourceVersion: 'v2', questionRevision: 1 }],
      }).total.answered,
    ).toBe(1);
    expect(
      aggregateDashboard(records, {
        ...query,
        modes: ['exam'],
        contexts: ['exam'],
        formats: ['choice-single'],
        certificationIds: ['aif-c01'],
      }).total.answered,
    ).toBe(2);
  });
});
