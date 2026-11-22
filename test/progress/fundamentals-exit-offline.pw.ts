import { expect, type Page, test } from '@playwright/test';
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

const asset = lessonAssets[0];
if (!asset) throw new Error('Missing first lesson fixture.');

async function hasQueuedFinalSave(page: Page, key: string) {
  return page.evaluate(async (outboxKey) => {
    const raw = localStorage.getItem(outboxKey);
    if (!raw) return false;
    const { validateLessonCommand } = await import('/src/fundamentals/state/outboxCodec.ts');
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== 'object' ||
      !('commands' in value) ||
      !Array.isArray(value.commands)
    ) {
      return false;
    }
    return value.commands.some((command) => validateLessonCommand(command).kind === 'saveResponse');
  }, key);
}

test('an offline member exit retains the final response until the resumed lesson flushes it', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  const outboxKey = lessonOutboxKey(session.userId);
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await setRealSession(page, session);
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await walkLessonReading(page, asset);
    await nextButton(page).click();
    const question = await visibleLessonQuestion(page, asset.finalQuestions);
    const selected = question.correct[0];
    if (!selected) throw new Error('Missing final answer fixture.');
    await selectLessonAnswer(page, question, [selected]);

    await context.setOffline(true);
    await page.getByRole('button', { name: '学習を終了', exact: true }).click();
    await expect(page).toHaveURL(/\/study\/fundamentals\/$/);
    await expect.poll(() => hasQueuedFinalSave(page, outboxKey)).toBe(true);

    await context.setOffline(false);
    await page.reload();
    await lessonCatalogCard(page, asset).getByRole('link').click();
    await expect(page).toHaveURL(/\/final\/1\/$/);
    await expect(
      page.locator(`fieldset input[name="${question.id}"][value="${selected}"]`),
    ).toBeChecked();
    await expect.poll(() => hasQueuedFinalSave(page, outboxKey)).toBe(false);
  } finally {
    await context.close();
  }
});
