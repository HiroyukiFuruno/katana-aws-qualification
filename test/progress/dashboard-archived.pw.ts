import { expect, test } from '@playwright/test';
import { dashboardText, expectDashboardMetrics } from './dashboard.helpers';
import { archivedAsset, archivedGuestFinal } from './fundamentals-edition.fixture';
import { lessonPrefix } from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

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
    const finals = page.getByRole('table', {
      name: dashboardText.dashboardFinalPassRate,
      exact: true,
    });
    await expect(finals).toContainText('100%');
    const progress = page
      .getByRole('table', { name: dashboardText.lessonProgress, exact: true })
      .getByRole('row')
      .filter({ hasText: archivedAsset.unit.title });
    await expect(progress).toContainText('0 / 27');
    await expect(progress).toContainText('0 / 4');
    await expect(progress).toContainText(dashboardText.fundamentalsNotStarted);
    await expect(progress).not.toContainText(dashboardText.lessonPassed);
    await expect(page.getByText(dashboardText.dashboardError, { exact: true })).toHaveCount(0);
    await page.reload();
    await expectDashboardMetrics(page, '16', '100%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(768);
    if (owner === 'guest') {
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
    }
  });
}
