import { expect, test } from '@playwright/test';
import content from '../../public/fundamentals/content.json' with { type: 'json' };
import { answer, startPractice } from './fundamentals-helpers';

test('another tab refreshes catalog progress while an active review queue stays fixed', async ({
  page,
  context,
}) => {
  const unit = content.units[0];
  const question = unit.questions[0];
  const other = await context.newPage();
  await page.goto('/ja/study/fundamentals/');
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: unit.title }) });
  await expect(card.locator('.fundamentals-status')).toContainText('未学習');
  await other.goto(`/ja/study/fundamentals/?unit=${unit.id}`);
  await startPractice(other);
  const wrong = question.choices.find((choice) => !question.correct.includes(choice.id));
  if (!wrong) throw Error('A wrong choice is required');
  await answer(other, [...question.correct.slice(0, -1), wrong.id]);
  await expect(card.locator('.fundamentals-status')).toContainText('復習対象あり');
  await card.getByRole('button', { name: '誤答を復習する' }).click();
  await other.goto(`/ja/study/fundamentals/?unit=${unit.id}&review=1`);
  await answer(other, question.correct);
  await expect(page.locator('.fundamentals-question .prompt')).toHaveText(question.prompt);
  await page.getByRole('button', { name: '基礎学習の目次' }).click();
  await expect(card.locator('.fundamentals-status')).toContainText('学習中');
  await other.evaluate(async () => {
    const module = '/src/history.ts';
    const { resetHistory } = await import(module);
    await resetHistory();
  });
  await expect(card.locator('.fundamentals-status')).toContainText('未学習');
});
