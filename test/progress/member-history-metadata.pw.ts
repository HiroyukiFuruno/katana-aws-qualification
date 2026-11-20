import { expect, type Page, test } from '@playwright/test';
import type { Question } from '../../src/questions';
import { learningEventRows } from './api';
import { openMemberCourse } from './course';
import { createSessions } from './sessions';

async function wrongQuestion(page: Page) {
  return page.evaluate(async () => {
    const { loadQuestions } = await import('/src/questions.ts');
    const question = (await loadQuestions('courses/saa-c03/questions.json')).find(
      (item) => !item.format && item.correct.length === 1 && item.choices.length >= 4,
    );
    if (!question) throw new Error('A single-answer question with wrong choices is required.');
    return question;
  });
}

async function answerWrong(page: Page, question: Question) {
  return page.evaluate(async (question) => {
    const selected = question.choices.find((choice) => !question.correct.includes(choice.id));
    if (!selected) throw new Error('The fixture must have a wrong choice.');
    const { saveAttempt } = await import('/src/history.ts');
    const saved = await saveAttempt(question, [selected.id], 'study', 200, 'saa-c03');
    return {
      attemptNumber: saved.attempt.attemptNumber,
      priorIncorrectCount: saved.attempt.priorIncorrectCount,
      isCorrect: saved.attempt.isCorrect,
    };
  }, question);
}

test('member tabs derive new attempt metadata from the current account question history', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  try {
    const first = await firstContext.newPage();
    const second = await secondContext.newPage();
    await openMemberCourse(first, session);
    await openMemberCourse(second, session);
    await expect(first.locator('.metrics strong').first()).toHaveText('0');
    await expect(second.locator('.metrics strong').first()).toHaveText('0');
    const question = await wrongQuestion(first);
    expect(await answerWrong(first, question)).toEqual({
      attemptNumber: 1,
      priorIncorrectCount: 0,
      isCorrect: false,
    });
    await expect(second.locator('.metrics strong').first()).toHaveText('0');
    expect(await answerWrong(second, question)).toEqual({
      attemptNumber: 2,
      priorIncorrectCount: 1,
      isCorrect: false,
    });
    await expect(second.locator('.metrics strong').first()).toHaveText('2');
    expect(await answerWrong(first, question)).toEqual({
      attemptNumber: 3,
      priorIncorrectCount: 2,
      isCorrect: false,
    });
    await expect
      .poll(() => learningEventRows(session))
      .toEqual(
        expect.arrayContaining(
          [1, 2, 3].map((number) =>
            expect.objectContaining({
              question_id: question.id,
              question_revision: question.revision,
              attempt_number: number,
              prior_incorrect_count: number - 1,
              is_correct: false,
            }),
          ),
        ),
      );
    expect(await learningEventRows(session)).toHaveLength(3);
    await second.reload();
    await expect(second.locator('.metrics strong').first()).toHaveText('3');
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
});
