import { expect, test } from '@playwright/test';
import { learningEvents } from './api';
import {
  finishLessonFinal,
  lessonAssets,
  lessonPrefix,
  nextButton,
  selectLessonAnswer,
  walkLessonReading,
} from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

const asset = lessonAssets[0];
if (!asset) throw new Error('Missing first lesson.');
const key = `${lessonPrefix}${asset.unit.id}.${asset.contentVersion}`;

for (const submitted of [true, false]) {
  test(`explicit guest lesson import preserves ${submitted ? 'a submitted result' : 'an active final'} and removes only verified source`, async ({
    page,
  }) => {
    const [session] = await createSessions();
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    await page.locator('.lesson-catalog-card').first().getByRole('link').click();
    await walkLessonReading(page, asset);
    if (submitted) {
      await finishLessonFinal(page, asset, 10);
      await page.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
    } else {
      await nextButton(page).click();
      const question = asset.finalQuestions[0];
      if (!question) throw new Error('Missing fixture final question.');
      await selectLessonAnswer(page, question, question.correct);
      await nextButton(page).click();
      await expect(page).toHaveURL(/\/final\/2\/$/);
      await page.getByRole('link', { name: '基礎学習の目次', exact: true }).click();
    }
    await expect(page).toHaveURL(/\/study\/fundamentals\/$/);
    await expect(page.getByRole('heading', { name: '基礎学習の目次', exact: true })).toBeVisible();
    const raw = await page.evaluate((key) => localStorage.getItem(key), key);
    expect(raw).not.toBeNull();
    await setRealSession(page, session);
    const prompt = page.getByRole('region', { name: `端末の記録を引き継ぐ · ${asset.unit.title}` });
    await expect(prompt).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(raw);
    await prompt.getByRole('button', { name: '自分の記録を取り込む', exact: true }).click();
    await expect.poll(() => learningEvents(session)).toHaveLength(submitted ? 16 : 4);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await expect(prompt).toHaveCount(0);
    await page.locator('.lesson-catalog-card').first().getByRole('link').click();
    if (submitted) {
      await expect(page).toHaveURL(/\/result\/$/);
      await expect(page.locator('.lesson-result-score')).toContainText('12問中 10問正解');
      await expect(page.locator('.lesson-result-pass')).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/final\/2\/$/);
      await page.getByRole('link', { name: '前へ', exact: true }).click();
      await expect(page).toHaveURL(/\/final\/1\/$/);
      await expect(page.locator('fieldset input:checked')).toHaveCount(
        asset.finalQuestions[0]?.requiredChoices ?? 0,
      );
    }
    await page.reload();
    if (submitted) await expect(page.locator('.lesson-result-pass')).toBeVisible();
    else
      await expect(page.locator('fieldset input:checked')).toHaveCount(
        asset.finalQuestions[0]?.requiredChoices ?? 0,
      );
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    expect(await learningEvents(session)).toHaveLength(submitted ? 16 : 4);
  });
}
