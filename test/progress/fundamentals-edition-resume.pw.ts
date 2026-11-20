import { expect, test } from '@playwright/test';
import { archivedAsset, archivedGuestFinal } from './fundamentals-edition.fixture';
import { lessonAssets, lessonPrefix, nextButton } from './fundamentals.helpers';

const current = lessonAssets[0];
if (!current) throw new Error('Missing revised fixture');
const key = `${lessonPrefix}${archivedAsset.unit.id}.${archivedAsset.contentVersion}`;
const query = `?version=${archivedAsset.contentVersion}`;

for (const submitted of [false, true]) {
  test(`a guest resumes an archived ${submitted ? 'pass' : 'draft'} without completing the revised lesson`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    const raw = JSON.stringify(archivedGuestFinal(submitted));
    await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
    await page.reload();
    const archive = page.locator('.lesson-archived-records');
    await expect(archive).toBeVisible();
    await archive.locator('summary').click();
    await archive.getByRole('link').click();
    await expect(page).toHaveURL(
      new RegExp(`${submitted ? 'result' : 'final/12'}/\\?version=${archivedAsset.contentVersion}$`),
    );
    await page.reload();
    if (!submitted) {
      await expect(page.locator('fieldset input:checked')).toHaveCount(
        archivedAsset.finalQuestions[11]?.requiredChoices ?? 0,
      );
      await page.getByRole('link', { name: '前へ', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`final/11/\\?version=${archivedAsset.contentVersion}$`));
      await expect(page.locator('.lesson-assessment-prompt')).toHaveText(
        archivedAsset.finalQuestions[10]?.prompt ?? '',
      );
      expect(archivedAsset.finalQuestions[10]?.prompt).not.toBe(current.finalQuestions[10]?.prompt);
      await nextButton(page).click();
      await nextButton(page).click();
    }
    await expect(page.locator('.lesson-result-pass')).toBeVisible();
    await expect(page.locator('.lesson-result-score')).toContainText('12問中 12問正解');
    expect(new URL(page.url()).search).toBe(query);
    await page.locator('.lesson-result-question').first().locator('summary').click();
    await page.locator('.lesson-result-question').first().getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`slides/\\d+/\\?version=${archivedAsset.contentVersion}$`));
    await page.getByRole('button', { name: '学習を終了', exact: true }).click();
    await expect(page).toHaveURL(/\/study\/fundamentals\/$/);
    await archive.locator('summary').click();
    await archive.getByRole('link').click();
    await expect(page.locator('.lesson-result-pass')).toBeVisible();
    await page.locator('.lesson-result-actions > button').click();
    await expect(page).toHaveURL(new RegExp(`final/1/\\?version=${archivedAsset.contentVersion}$`));
    await expect(nextButton(page)).toBeDisabled();
    await page.getByRole('button', { name: '学習を終了', exact: true }).click();
    await page.locator('.lesson-catalog-card').first().getByRole('link').click();
    await expect(page.locator('.lesson-slide-meta')).toContainText(`STEP 1 / ${current.totalSteps}`);
    expect(new URL(page.url()).search).toBe('');
    const revisedKey = `${lessonPrefix}${current.unit.id}.${current.contentVersion}`;
    expect(await page.evaluate((key) => localStorage.getItem(key), revisedKey)).toBeNull();
    const retained = await page.evaluate((key) => localStorage.getItem(key), key);
    expect(JSON.parse(retained ?? '{}').submittedFinals).toHaveLength(1);
  });
}
