import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { lessonAssets, nextButton, selectLessonAnswer, walkLessonReading } from './fundamentals.helpers';

test('every final question requires its specified selection count before next or submit', async ({
  page,
}) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing first lesson fixture.');
  await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
  await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  await walkLessonReading(page, asset);
  await nextButton(page).click();
  for (const [index, question] of asset.finalQuestions.entries()) {
    await expect(page).toHaveURL(new RegExp(`/final/${index + 1}/$`));
    await expect(nextButton(page)).toBeDisabled();
    if (question.requiredChoices > 1) {
      await selectLessonAnswer(page, question, [question.correct[0]]);
      await expect(nextButton(page)).toBeDisabled();
    }
    await selectLessonAnswer(page, question, question.correct);
    await expect(nextButton(page)).toBeEnabled();
    if (index === asset.finalQuestions.length - 1)
      await expect(nextButton(page)).toHaveText('回答を提出');
    await nextButton(page).click();
  }
  await expect(page.locator('.lesson-result-pass')).toBeVisible();
  await expect(page.locator('.lesson-result-score')).toContainText('12問中 12問正解');
});
