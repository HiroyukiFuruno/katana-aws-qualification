import { expect, test } from '@playwright/test';
import { dashboardText, expectDashboardMetrics } from './dashboard.helpers';
import { setDashboardDensity, showDashboardWidget } from './dashboard-actions';
import { lessonAssets, lessonPrefix } from './fundamentals.helpers';
import { archivedAsset, archivedGuestFinal } from './fundamentals-edition.fixture';
import { createSessions, setRealSession } from './sessions';

const currentAsset = lessonAssets.find((asset) => asset.unit.id === archivedAsset.unit.id);
if (!currentAsset) throw new Error('Missing current lesson fixture for the archived unit');
const currentSlideCount = currentAsset.steps.filter(
  (step) => step.kind !== 'checkpoint' && step.kind !== 'final',
).length;

for (const owner of ['guest', 'member'] as const) {
  test(`the ${owner} dashboard counts archived answers without granting current lesson completion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const key = `${lessonPrefix}${archivedAsset.unit.id}.${archivedAsset.contentVersion}`;
    const raw = JSON.stringify(archivedGuestFinal(true));
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
    await page.reload();
    if (owner === 'member') {
      const [session] = await createSessions();
      await setRealSession(page, session);
      const prompt = page.getByRole('region', {
        name: `端末の記録を引き継ぐ · ${archivedAsset.unit.title}`,
      });
      await prompt.getByRole('button', { name: '自分の記録を取り込む', exact: true }).click();
      await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    }
    await page.goto('/ja/dashboard/');
    await expectDashboardMetrics(page, '16', '100%');
    await setDashboardDensity(page, 'full');
    await showDashboardWidget(page, dashboardText.dashboardWidgetExams);
    const finals = page.getByRole('table', {
      name: dashboardText.dashboardFinalPassRate,
      exact: true,
    });
    await expect(finals).toContainText('100%');
    const progress = page.locator('.dashboard-widget').filter({
      has: page.getByRole('heading', { name: dashboardText.dashboardWidgetLessons, exact: true }),
    });
    await showDashboardWidget(page, dashboardText.dashboardWidgetLessons);
    const lessonProgress = progress
      .getByRole('table', { name: dashboardText.lessonProgress, exact: true })
      .getByRole('row')
      .filter({ hasText: currentAsset.unit.title });
    await expect(lessonProgress).toContainText(`0 / ${currentSlideCount}`);
    await expect(lessonProgress).toContainText(`0 / ${currentAsset.checkpoints.length}`);
    await expect(lessonProgress).toContainText(dashboardText.fundamentalsNotStarted);
    await expect(lessonProgress).not.toContainText(dashboardText.lessonPassed);
    await expect(page.getByText(dashboardText.dashboardError, { exact: true })).toHaveCount(0);
    await page.reload();
    await expectDashboardMetrics(page, '16', '100%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
    if (owner === 'guest') {
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
    }
  });
}
