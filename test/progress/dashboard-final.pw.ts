import { expect, test } from '@playwright/test';
import { dashboardText } from './dashboard.helpers';
import {
  finishLessonFinal,
  lessonAssets,
  lessonCatalogCard,
  walkLessonReading,
} from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

test('fundamentals final result and dashboard keep final-test scope separate', async ({ browser }) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const asset = lessonAssets[0];
    if (!asset) throw new Error('Missing fundamentals fixture.');
    await page.goto('/ja/study/fundamentals/');
    await setRealSession(page, session);
    await page.reload();
    const necessary = page.getByRole('button', { name: '必要なもののみ', exact: true });
    if (await necessary.isVisible()) await necessary.click();
    await lessonCatalogCard(page, asset).getByRole('link').click();
    await walkLessonReading(page, asset);
    await finishLessonFinal(page, asset, 10);
    await expect(page.locator('.lesson-result-score')).toContainText('12問中 10問正解');
    await page.goto('/ja/dashboard/');
    await expect(page.getByRole('heading', { name: dashboardText.dashboardTitle })).toBeVisible();
    const finals = page.getByRole('table', { name: dashboardText.dashboardFinalPassRate, exact: true });
    await expect(finals).toContainText('100%');
    const exams = page.getByRole('table', { name: new RegExp(dashboardText.dashboardWidgetExams) });
    await expect(exams).toContainText('10 / 12');
    await expect(exams).toContainText(dashboardText.lessonPassed);
    const progress = page
      .getByRole('table', { name: dashboardText.lessonProgress, exact: true })
      .getByRole('row')
      .filter({ hasText: asset.unit.title });
    await expect(progress).toContainText('27 / 27');
    await expect(progress).toContainText('4 / 4');
    await expect(progress).toContainText(dashboardText.lessonPassed);
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('katana.fundamentals-progress.v1.')),
      ),
    ).toEqual([]);
  } finally {
    await context.close();
  }
});
