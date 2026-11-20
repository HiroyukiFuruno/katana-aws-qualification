import type { Page } from '@playwright/test';
import type { Question } from '../../src/questions';

export const historyKey = 'saa-study.attempts.v1';

export type WrongAnswerFixture = {
  question: Question;
  selected: [string, string, string];
  seeded: { selected: string[]; isCorrect: boolean; attemptNumber: number; priorIncorrectCount: number };
};

export async function seedDiskWrongAttempt(page: Page): Promise<WrongAnswerFixture> {
  return page.evaluate(async (key) => {
    const [{ loadQuestions }, { makeAttempt }] = await Promise.all([
      import('/src/questions.ts'),
      import('/src/attempts.ts'),
    ]);
    const question = (await loadQuestions('courses/saa-c03/questions.json')).find(
      (item) => !item.format && item.correct.length === 1 && item.choices.length - 1 >= 3,
    );
    if (!question) throw new Error('A question with three valid wrong choices is required.');
    const selected = question.choices
      .map((choice) => choice.id)
      .filter((choice) => !question.correct.includes(choice))
      .slice(0, 3);
    const [firstWrong, secondWrong, thirdWrong] = selected;
    if (!firstWrong || !secondWrong || !thirdWrong)
      throw new Error('The selected fixture question has too few wrong choices.');
    const seeded = makeAttempt([], question, [firstWrong], 'study', 1000, '2026-01-01T00:00:00.000Z');
    localStorage.setItem(key, JSON.stringify([seeded]));
    return {
      question,
      selected: [firstWrong, secondWrong, thirdWrong] as [string, string, string],
      seeded,
    };
  }, historyKey);
}

export async function saveGuestAttempt(page: Page, fixture: WrongAnswerFixture, selected: string) {
  return page.evaluate(
    async ({ question, selected }) => {
      const { saveAttempt } = await import('/src/history.ts');
      const result = await saveAttempt(question, [selected], 'study', 200, 'saa-c03');
      return {
        selected: result.attempt.selected,
        isCorrect: result.attempt.isCorrect,
        attemptNumber: result.attempt.attemptNumber,
        priorIncorrectCount: result.attempt.priorIncorrectCount,
      };
    },
    { question: fixture.question, selected },
  );
}

export async function storedAttempts(page: Page) {
  return page.evaluate(async (key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { selected: string[]; isCorrect: boolean }[]) : [];
  }, historyKey);
}

export async function progressAttempts(page: Page) {
  return page.evaluate(async () => {
    const { getActiveProgressStore } = await import('/src/history.ts');
    const snapshot = getActiveProgressStore()?.getSnapshot();
    if (snapshot?.state !== 'ready') throw new Error('Guest progress store is not ready.');
    return snapshot.attempts.map((attempt) => ({
      selected: attempt.selected,
      isCorrect: attempt.isCorrect,
      attemptNumber: attempt.attemptNumber,
      priorIncorrectCount: attempt.priorIncorrectCount,
    }));
  });
}
