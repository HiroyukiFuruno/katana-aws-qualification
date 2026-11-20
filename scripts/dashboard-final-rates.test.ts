import { expect, test } from 'bun:test';
import { dashboardFinalRates } from '../src/dashboard/finalRates';
import type { DashboardLessonFinal } from '../src/dashboard/summaryTypes';

function session(unitId: string, contentVersion: string, score: number): DashboardLessonFinal {
  const stats = {
    answered: 12,
    correct: score,
    accuracy: score / 12,
    durationMs: 12000,
    meanDurationMs: 1000,
  };
  return {
    sessionId: crypto.randomUUID(),
    unitId,
    contentVersion,
    score,
    passed: score >= 10,
    requiredScore: 10,
    questionCount: 12,
    startedAt: '2026-11-20T10:00:00Z',
    submittedAt: '2026-11-20T10:12:00Z',
    stats,
    allAnswers: stats,
  };
}
test('final pass rates keep units and published content versions separate', () => {
  const result = dashboardFinalRates([
    session('unit-a', 'v1', 10),
    session('unit-a', 'v1', 9),
    session('unit-a', 'v2', 12),
    session('unit-b', 'v1', 8),
  ]);
  expect(
    result.map(({ unitId, contentVersion, attempts, passed, passRate }) => ({
      unitId,
      contentVersion,
      attempts,
      passed,
      passRate,
    })),
  ).toEqual([
    { unitId: 'unit-a', contentVersion: 'v1', attempts: 2, passed: 1, passRate: 0.5 },
    { unitId: 'unit-a', contentVersion: 'v2', attempts: 1, passed: 1, passRate: 1 },
    { unitId: 'unit-b', contentVersion: 'v1', attempts: 1, passed: 0, passRate: 0 },
  ]);
  expect(dashboardFinalRates([])).toEqual([]);
});
