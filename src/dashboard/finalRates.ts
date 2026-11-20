import type { DashboardLessonFinal } from './summaryTypes';

export function dashboardFinalRates(sessions: readonly DashboardLessonFinal[]) {
  const groups = new Map<
    string,
    { unitId: string; contentVersion: string; attempts: number; passed: number }
  >();
  for (const session of sessions) {
    const key = JSON.stringify([session.unitId, session.contentVersion]);
    const group = groups.get(key) ?? {
      unitId: session.unitId,
      contentVersion: session.contentVersion,
      attempts: 0,
      passed: 0,
    };
    group.attempts++;
    group.passed += Number(session.passed);
    groups.set(key, group);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([id, group]) => ({ id, ...group, passRate: group.passed / group.attempts }));
}
