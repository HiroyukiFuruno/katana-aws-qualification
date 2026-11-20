import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonAssets, lessonCatalogCard, nextButton } from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

test('another tab cannot resurrect a discarded shared command when saving a different unit', async ({
  browser,
}) => {
  const [a, b] = lessonAssets;
  if (!a || !b) throw new Error('Missing shared outbox fixtures.');
  const [session] = await createSessions();
  const shared = await browser.newContext();
  const external = await browser.newContext();
  try {
    const first = await shared.newPage();
    const updater = await external.newPage();
    for (const page of [first, updater]) {
      await page.goto('/ja/study/fundamentals/');
      await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
      await setRealSession(page, session);
      await page.goto(lessonPath({ locale: 'ja', unitId: a.unit.id, stage: 'resume' }));
      await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${a.totalSteps}`);
    }
    await nextButton(updater).click();
    await expect(updater.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${a.totalSteps}`);
    await nextButton(first).click();
    const reload = first.getByRole('button', { name: '保存済みの回答を再読み込み', exact: true });
    await expect(reload).toBeVisible();
    const key = `katana.fundamentals-outbox.v1.${session.userId}`;
    expect(await first.evaluate((key) => localStorage.getItem(key), key)).not.toBeNull();
    const second = await shared.newPage();
    await second.goto('/ja/study/fundamentals/');
    await expect(second.locator('.progress-status > .progress-source')).toHaveText(
      'アカウント・同期した記録',
    );
    await expect(lessonCatalogCard(second, a).getByRole('status')).toBeVisible();
    await lessonCatalogCard(second, a).getByRole('link').click();
    await expect(
      second.getByRole('button', { name: '保存済みの回答を再読み込み', exact: true }),
    ).toBeVisible();
    await reload.click();
    await expect(reload).not.toBeVisible();
    await expect(first.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${a.totalSteps}`);
    expect(await first.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await second.goBack();
    await expect(second).toHaveURL(/\/fundamentals\/$/);
    await lessonCatalogCard(second, b).getByRole('link').click();
    await expect(second.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${b.totalSteps}`);
    await nextButton(second).click();
    await expect(second.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${b.totalSteps}`);
    expect(await second.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await second.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
    await lessonCatalogCard(second, a).getByRole('link').click();
    await expect(second.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${a.totalSteps}`);
    expect(await second.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  } finally {
    await Promise.all([shared.close(), external.close()]);
  }
});
