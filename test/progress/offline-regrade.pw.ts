import { expect, test, type Page } from '@playwright/test';
import { learningEventRows } from './api';
import { openMemberCourse, startStudy } from './course';
import { createSessions } from './sessions';

type QuestionPlan = { choices: string[]; correct: string[]; id: string; revision: number };
type CourseQuestion = Omit<QuestionPlan, 'choices'> & {
  choices: { id: string }[];
  prompt: string;
};

function sameSelection(left: string[], right: string[]) {
  return [...left].sort().join(',') === [...right].sort().join(',');
}

async function currentPlan(page: Page): Promise<QuestionPlan> {
  return page.evaluate(async () => {
    const prompt = document.querySelector('.prompt')?.textContent;
    if (!prompt) throw new Error('Could not resolve the active question.');
    const responses = await Promise.all(
      ['mock-questions.json', 'questions.json', 'extra-questions.json'].map((path) =>
        fetch(`/courses/saa-c03/${path}`),
      ),
    );
    if (responses.some((response) => !response.ok)) throw new Error('Could not load the course bank.');
    const questions = (
      await Promise.all(responses.map((response) => response.json()))
    ).flat() as CourseQuestion[];
    const question = questions.find((item) => item.prompt === prompt);
    if (!question) throw new Error('The active question is absent from the course bank.');
    return {
      choices: question.choices.map((choice) => choice.id),
      correct: question.correct,
      id: question.id,
      revision: question.revision,
    };
  });
}

async function select(page: Page, plan: QuestionPlan, selected: string[]) {
  const inputs = page.locator('input[name="answer"]');
  if (plan.correct.length > 1) {
    for (let index = 0; index < plan.choices.length; index++) {
      const input = inputs.nth(index);
      if (await input.isChecked()) await input.uncheck();
    }
  }
  for (const choice of selected) await inputs.nth(plan.choices.indexOf(choice)).check();
}

test('an offline wrong answer followed by a corrected answer preserves both member events', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await openMemberCourse(page, session);
    await startStudy(page);
    const plan = await currentPlan(page);
    const wrong = plan.choices
      .filter((choice) => !plan.correct.includes(choice))
      .slice(0, plan.correct.length);
    expect(wrong).toHaveLength(plan.correct.length);
    await select(page, plan, wrong);

    await context.setOffline(true);
    await page.getByRole('button', { name: '採点する' }).click();
    await expect(
      page.getByText('学習履歴を保存できませんでした。保存領域の設定を確認してから再試行してください。'),
    ).toBeVisible();
    await context.setOffline(false);
    await select(page, plan, plan.correct);
    await page.getByRole('button', { name: '採点する' }).click();
    await expect(page.getByRole('status')).toContainText('正解');

    await expect.poll(() => learningEventRows(session)).toHaveLength(2);
    const events = await learningEventRows(session);
    const wrongEvent = events.find((event) => sameSelection(event.selected, wrong));
    const correctedEvent = events.find((event) => sameSelection(event.selected, plan.correct));
    expect(wrongEvent).toMatchObject({
      attempt_number: 1,
      is_correct: false,
      prior_incorrect_count: 0,
      question_id: plan.id,
      question_revision: plan.revision,
      selected: wrong,
    });
    expect(correctedEvent).toMatchObject({
      attempt_number: 2,
      is_correct: true,
      prior_incorrect_count: 1,
      question_id: plan.id,
      question_revision: plan.revision,
      selected: plan.correct,
    });
    expect(correctedEvent?.event_id).not.toBe(wrongEvent?.event_id);
    await expect(page.locator('.metrics')).toContainText('2');
  } finally {
    await context.close();
  }
});
