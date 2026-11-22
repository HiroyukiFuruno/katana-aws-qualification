import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { learningEvents } from './api';
import {
  lessonAssets,
  nextButton,
  selectLessonAnswer,
  visibleLessonQuestion,
  walkLessonReading,
} from './fundamentals.helpers';
import { createSessions, setRealSession } from './sessions';

test('a stale member final reloads canonical selections before another save', async ({ browser }) => {
  const asset = lessonAssets[0];
  if (!asset) throw new Error('Missing conflict fixture.');
  const [session] = await createSessions();
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [first, second] = await Promise.all(contexts.map((context) => context.newPage()));
    if (!first || !second) throw new Error('Missing member pages.');
    for (const page of [first, second]) {
      await page.goto('/ja/study/fundamentals/');
      await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
      await setRealSession(page, session);
    }
    await first.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await walkLessonReading(first, asset);
    await nextButton(first).click();
    await expect(first.locator('fieldset')).toBeVisible();
    const question = await visibleLessonQuestion(first, asset.finalQuestions);
    const wrong = question.choices.find((choice) => !question.correct.includes(choice.id));
    if (!wrong) throw new Error('Missing conflict fixture choice.');
    await second.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'final', position: 1 }));
    await expect(second.locator('fieldset')).toBeVisible();
    await selectLessonAnswer(first, question, question.correct);
    await selectLessonAnswer(second, question, [wrong.id]);
    await nextButton(first).click();
    await expect(first).toHaveURL(/\/final\/2\/$/);
    await nextButton(second).click();
    const reload = second.getByRole('button', { name: '保存済みの回答を再読み込み', exact: true });
    await expect(reload).toBeVisible();
    await reload.click();
    for (const choice of question.choices) {
      await expect(
        second.locator(`fieldset input[name="${question.id}"][value="${choice.id}"]`),
      ).toBeChecked({
        checked: question.correct.includes(choice.id),
      });
    }
    await expect(nextButton(second)).toBeEnabled();
    await nextButton(second).click();
    await expect(second).toHaveURL(/\/final\/2\/$/);
    expect(
      await second.evaluate(
        (id) => localStorage.getItem(`katana.fundamentals-outbox.v1.${id}`),
        session.userId,
      ),
    ).toBeNull();
    expect(await learningEvents(session)).toHaveLength(4);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
