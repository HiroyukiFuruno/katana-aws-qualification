import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonOutboxKey } from '../../src/fundamentals/state/outboxCodec';
import {
  lessonAssets,
  lessonCatalogCard,
  nextButton,
  selectLessonAnswer,
  visibleLessonQuestion,
  walkLessonReading,
} from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

test('storage exhaustion keeps the unpersisted final answer on screen and allows a real retry', async ({
  page,
}) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing lesson fixture.');
  const [session] = await createSessions();
  await page.goto('/ja/study/fundamentals/');
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await setRealSession(page, session);
  await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
  await walkLessonReading(page, asset);
  await nextButton(page).click();
  const question = await visibleLessonQuestion(page, asset.finalQuestions);
  await selectLessonAnswer(page, question, question.correct);
  const filled = await page.evaluate(() => {
    let count = 0;
    let exhausted = false;
    for (const size of [1024 * 1024, 64 * 1024, 1024, 16, 1]) {
      for (let attempt = 0; attempt < 128; attempt++) {
        try {
          localStorage.setItem(`fixture-quota.${count}`, 'x'.repeat(size));
          count++;
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== 'QuotaExceededError') throw error;
          exhausted = true;
          break;
        }
      }
    }
    return { count, exhausted };
  });
  expect(filled.exhausted).toBe(true);
  expect(filled.count).toBeGreaterThan(0);
  await page.getByRole('button', { name: '学習を終了', exact: true }).click();
  await expect(page.locator('.lesson-slide-save-state [role="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/final\/1\/$/);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), lessonOutboxKey(session.userId)),
  ).toBeNull();
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('fixture-quota.')) localStorage.removeItem(key);
  });
  await page
    .locator('.lesson-slide-save-state')
    .getByRole('button', { name: '再試行', exact: true })
    .click();
  await expect(page).toHaveURL(/\/study\/fundamentals\/$/);
  await lessonCatalogCard(page, asset).getByRole('link').click();
  await expect(page).toHaveURL(/\/final\/1\/$/);
  for (const selected of question.correct)
    await expect(
      page.locator(`fieldset input[name="${question.id}"][value="${selected}"]`),
    ).toBeChecked();
});
