import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonAssets, walkLessonReading } from '../progress/fundamentals.helpers';
import { acceptNecessaryCookies } from '../progress/fundamentals-mobile.helpers';

test('another tab refreshes the catalog summary and reset clears the guest record', async ({
  page,
  context,
}) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing fundamentals asset.');
  await page.goto('/ja/study/fundamentals/');
  await acceptNecessaryCookies(page);
  await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
  const card = page.locator('.lesson-catalog-card').filter({
    has: page.getByRole('heading', { name: asset.unit.title, exact: true }),
  });
  await expect(card.locator('.lesson-catalog-status')).toContainText('未学習');
  const other = await context.newPage();
  await other.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
  await acceptNecessaryCookies(other);
  await walkLessonReading(other, asset);
  await other.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
  await expect(card.locator('.lesson-catalog-status')).toContainText('学習中');
  await other.evaluate(async () => {
    const { resetHistory } = await import('/src/history.ts');
    await resetHistory();
  });
  await expect(card.locator('.lesson-catalog-status')).toContainText('未学習');
  await other.close();
});
