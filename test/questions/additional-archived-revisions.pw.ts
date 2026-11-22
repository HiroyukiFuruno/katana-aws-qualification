import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { additionalRevisionArchives } from '../../scripts/additional-revision-archive.fixture';
import { messages } from '../../src/messages';
import { parseQuestions } from '../../src/questions';

for (const migration of additionalRevisionArchives) {
  test(`saved ${migration.id} rev1 draft resumes, displays its correction, and preserves grading`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const question = parseQuestions(
      JSON.parse(readFileSync(`public/${migration.archive}`, 'utf8')),
    ).find(({ id }) => id === migration.id);
    if (!question) throw new Error(`Missing archived ${migration.id}`);
    const questionKey = JSON.stringify([question.id, question.revision]);
    await page.goto(`/ja/study/${migration.certification}/`);
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する', { exact: true }).check();
    await page.evaluate(
      ({ examKey, key, selected }) => {
        localStorage.setItem(
          examKey,
          JSON.stringify({
            id: crypto.randomUUID(),
            deadline: Date.now() + 3_600_000,
            order: [key],
            position: 0,
            responses: { [key]: { selected, flagged: false, durationMs: 1_200 } },
          }),
        );
      },
      { examKey: migration.examKey, key: questionKey, selected: question.correct },
    );
    await page.reload();
    await page.getByRole('button', { name: '模擬試験', exact: true }).click();
    await expect(page.locator('.prompt')).toHaveText(question.prompt);
    await expect(page.locator('.question-clarification')).toHaveText(
      (messages.ja as Record<string, string>)[migration.key],
    );
    for (const answer of question.correct) {
      const choice = question.choices.find(({ id }) => id === answer);
      if (!choice) throw new Error(`Missing correct choice ${answer}`);
      await expect(
        page
          .locator('label.choice')
          .filter({ has: page.getByText(choice.text, { exact: true }) })
          .getByRole(question.correct.length > 1 ? 'checkbox' : 'radio'),
      ).toBeChecked();
    }
    await page.getByRole('button', { name: '試験を提出する' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '提出する', exact: true }).click();
    await expect(page.locator('.exam-score')).toHaveText('1問中 1問正解');
    await page.getByLabel(messages.ja.includeCorrect).check();
    const review = page.locator('.exam-solutions details');
    await review.locator('summary').click();
    await expect(review.locator('.question-clarification')).toHaveText(
      (messages.ja as Record<string, string>)[migration.key],
    );
    const history = await page.evaluate(() => localStorage.getItem('saa-study.attempts.v1'));
    if (history === null) throw new Error('Saved exam history is missing');
    expect(JSON.parse(history)).toEqual([
      expect.objectContaining({
        questionId: question.id,
        questionRevision: 1,
        correct: question.correct,
        isCorrect: true,
      }),
    ]);
    expect(errors).toEqual([]);
  });
}
