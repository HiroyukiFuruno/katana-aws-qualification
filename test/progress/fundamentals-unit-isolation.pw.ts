import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonAssets, lessonCatalogCard, nextButton } from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

test('a conflicted unit retains its command while another unit and the catalog remain usable', async ({
  browser,
}) => {
  const [a, b] = lessonAssets;
  if (!a || !b) throw new Error('Missing isolation fixtures.');
  const [session] = await createSessions();
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [first, second] = await Promise.all(contexts.map((context) => context.newPage()));
    if (!first || !second) throw new Error('Missing member pages.');
    for (const page of [first, second]) {
      await page.goto('/ja/study/fundamentals/');
      await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
      await setRealSession(page, session);
      await page.goto(lessonPath({ locale: 'ja', unitId: a.unit.id, stage: 'resume' }));
      await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${a.totalSteps}`);
    }
    await nextButton(first).click();
    await expect(first.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${a.totalSteps}`);
    await nextButton(second).click();
    await expect(
      second.getByRole('button', { name: '保存済みの回答を再読み込み', exact: true }),
    ).toBeVisible();
    const key = `katana.fundamentals-outbox.v1.${session.userId}`;
    const original = await second.evaluate((key) => localStorage.getItem(key), key);
    expect(original).not.toBeNull();
    await second.goto(lessonPath({ locale: 'ja', unitId: b.unit.id, stage: 'resume' }));
    await expect(second.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${b.totalSteps}`);
    await nextButton(second).click();
    await expect(second.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${b.totalSteps}`);
    expect(await second.evaluate((key) => localStorage.getItem(key), key)).toBe(original);
    await second.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
    await expect(second.locator('.lesson-catalog-card')).toHaveCount(12);
    const card = lessonCatalogCard(second, a);
    await expect(card.getByRole('status')).toContainText('保存待ちの記録');
    await card.getByRole('link').click();
    await second.getByRole('button', { name: '保存済みの回答を再読み込み', exact: true }).click();
    await expect(second.locator('.lesson-slide-meta')).toContainText(`STEP 2 / ${a.totalSteps}`);
    expect(await second.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
