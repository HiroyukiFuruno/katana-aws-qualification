import { expect, test } from 'bun:test';
import { aggregateDashboard } from '../src/dashboard/aggregate';
import { readDashboardSummary } from '../src/dashboard/summaryCodec';
import { query, records } from './dashboard-fixture';

test('strict summary decoder accepts verified aggregation and JSONB reordered keys', () => {
  const expected = aggregateDashboard(records, query);
  const copy = structuredClone(expected);
  copy.query = Object.fromEntries(Object.entries(copy.query).reverse()) as typeof copy.query;
  expect(readDashboardSummary(copy, query)).toEqual(expected);
});

test('rejects malformed nested rows and inconsistent totals instead of rendering zeros', () => {
  const valid = () => structuredClone(aggregateDashboard(records, query));
  const mismatched = valid();
  mismatched.query.certificationIds = ['other'];
  expect(() => readDashboardSummary(mismatched, query)).toThrow();
  const average = valid();
  average.total.accuracy = 0.75;
  expect(() => readDashboardSummary(average, query)).toThrow();
  const nested = valid();
  Object.assign(nested.groups.categories[0], { arbitrary: 1 });
  expect(() => readDashboardSummary(nested, query)).toThrow();
  const totals = valid();
  totals.daily = [];
  expect(() => readDashboardSummary(totals, query)).toThrow();
  const bins = valid();
  bins.duration.bins[0].count++;
  expect(() => readDashboardSummary(bins, query)).toThrow();
  const quartiles = valid();
  quartiles.duration.p50 = 9999999;
  expect(() => readDashboardSummary(quartiles, query)).toThrow();
  const duplicate = valid();
  duplicate.facets.certificationIds.push(duplicate.facets.certificationIds[0]);
  expect(() => readDashboardSummary(duplicate, query)).toThrow();
  const session = valid();
  session.exams[0].stats.answered = 100;
  expect(() => readDashboardSummary(session, query)).toThrow();
  const review = valid();
  review.review[0].context = 'exam';
  expect(() => readDashboardSummary(review, query)).toThrow();
});

test('empty summary keeps null rates and null quantiles', () => {
  const empty = aggregateDashboard(
    { events: [], exams: [], lessonFinals: [], excludedRecords: 0 },
    query,
  );
  expect(readDashboardSummary(empty, query)).toEqual(empty);
  empty.total.accuracy = 0;
  expect(() => readDashboardSummary(empty, query)).toThrow();
});
