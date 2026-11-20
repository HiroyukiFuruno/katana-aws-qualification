import { expect, test } from '@playwright/test';
import { openMemberCourse } from './course';
import { dashboardText, expectDashboardMetrics } from './dashboard.helpers';
import {
  chartFixture,
  saveAllDashboardWidgets,
  seedChartFixture,
  selectFixtureCharts,
} from './dashboard-chart.helpers';
import { expectDefaultCharts, expectModifiedCharts } from './dashboard-chart.math';
import { expectAlternativeCharts } from './dashboard-chart.views';
import { createSessions } from './sessions';

for (const view of ['default', 'geometry', 'alternatives'] as const) {
  test(`real member dashboard ${view} charts match fixed answer data`, async ({ browser }) => {
    const [session] = await createSessions();
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await openMemberCourse(page, session);
      await expect
        .poll(() =>
          page.evaluate(async (id) => {
            const { getActiveProgressStore } = await import('/src/history.ts');
            const snapshot = getActiveProgressStore()?.getSnapshot();
            return (
              snapshot?.state === 'ready' &&
              snapshot.owner.kind === 'member' &&
              snapshot.owner.userId === id
            );
          }, session.userId),
        )
        .toBe(true);
      const fixture = await seedChartFixture(page);
      await page.goto('/ja/dashboard/');
      await expectDashboardMetrics(page, String(chartFixture.total), '83.3%');
      const necessary = page.getByRole('button', { name: '必要なもののみ', exact: true });
      if (await necessary.isVisible()) await necessary.click();
      await saveAllDashboardWidgets(page);
      if (view === 'default') await expectDefaultCharts(page, fixture);
      else if (view === 'geometry') {
        await selectFixtureCharts(page);
        await expectModifiedCharts(page, fixture);
      } else await expectAlternativeCharts(page, fixture);
      await expect(page.getByText(dashboardText.dashboardError, { exact: true })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
