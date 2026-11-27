import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { object } from '../../src/fundamentals/state/codecPrimitives';
import { validateLessonCommand } from '../../src/fundamentals/state/outboxCodec';
import { learningEvents } from './api';
import {
  finishLessonFinal,
  lessonAssets,
  lessonPrefix,
  lessonSlideCount,
  nextButton,
  visibleLessonSteps,
  walkLessonReading,
} from './fundamentals.helpers';
import { memberLessonSnapshot } from './fundamentals-member-snapshot';
import { createSessions, setRealSession } from './sessions';

const asset = lessonAssets[0];
if (!asset) throw new Error('Missing first lesson fixture.');

function expectStep(page: Parameters<typeof nextButton>[0], position: number) {
  return expect(page.locator('.lesson-slide-meta')).toContainText(
    `STEP ${position} / ${lessonSlideCount(asset)}`,
  );
}

test('member lesson checkpoints and one final persist in real DB without a guest copy', async ({
  browser,
}) => {
  const [a, b] = await createSessions();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await setRealSession(page, a);
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await walkLessonReading(page, asset);
    await finishLessonFinal(page, asset, 10);
    await expect(page.locator('.lesson-result-pass')).toBeVisible();
    await expect.poll(() => learningEvents(a)).toHaveLength(16);
    const confirmed = await memberLessonSnapshot(a, asset);
    expect(confirmed.progress.passedFinalSessionId).toBeTruthy();
    expect(confirmed.sessions).toHaveLength(1);
    expect(confirmed.sessions[0]).toMatchObject({ score: 10, passed: true, state: 'submitted' });
    await page.reload();
    await expect(page.locator('.lesson-result-pass')).toBeVisible();
    expect(await memberLessonSnapshot(a, asset)).toEqual(confirmed);
    expect(await learningEvents(a)).toHaveLength(16);
    expect((await memberLessonSnapshot(b, asset)).sessions).toEqual([]);
    expect(await learningEvents(b)).toEqual([]);
    expect(
      await page.evaluate(
        (prefix) =>
          Object.keys(localStorage).filter(
            (key) => key.startsWith(prefix) || key.startsWith('katana.fundamentals-outbox.v1.'),
          ),
        lessonPrefix,
      ),
    ).toEqual([]);
  } finally {
    await context.close();
  }
});

test('a real offline member step retries its immutable outbox command and resumes after reload', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  const key = `katana.fundamentals-outbox.v1.${session.userId}`;
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await setRealSession(page, session);
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await expectStep(page, 1);
    await context.setOffline(true);
    await nextButton(page).click();
    await expect(page.locator('.lesson-slide-save-state [role="alert"]')).toBeVisible();
    const pending = await page.evaluate((key) => localStorage.getItem(key), key);
    expect(pending).not.toBeNull();
    const envelope = object(JSON.parse(pending ?? ''), 'outbox');
    if (!Array.isArray(envelope.commands)) throw new Error('Missing outbox commands.');
    const command = validateLessonCommand(envelope.commands[0]);
    expect(command.kind).toBe('recordStep');
    expect(command.input.expectedRevision).toBe(0);
    await context.setOffline(false);
    await page
      .locator('.lesson-slide-save-state')
      .getByRole('button', { name: '再試行', exact: true })
      .click();
    await expectStep(page, 2);
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    expect((await memberLessonSnapshot(session, asset)).progress).toMatchObject({
      furthestPlanPosition: visibleLessonSteps(asset)[1].position - 1,
      revision: visibleLessonSteps(asset)[1].position - 1,
    });
    await page.reload();
    await expectStep(page, 2);
  } finally {
    await context.close();
  }
});

test('native back and forward recover an earlier offline command before another member edit', async ({
  browser,
}) => {
  const [session] = await createSessions();
  const context = await browser.newContext();
  const key = `katana.fundamentals-outbox.v1.${session.userId}`;
  try {
    const page = await context.newPage();
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await setRealSession(page, session);
    await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
    await nextButton(page).click();
    await expectStep(page, 2);
    await context.setOffline(true);
    await nextButton(page).click();
    await expect(page.locator('.lesson-slide-save-state [role="alert"]')).toBeVisible();
    await context.setOffline(false);
    await page.goBack();
    await expectStep(page, 1);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await expect(nextButton(page)).toBeEnabled();
    await page.goForward();
    await expectStep(page, 2);
    await nextButton(page).click();
    await expectStep(page, 3);
    expect((await memberLessonSnapshot(session, asset)).progress.furthestPlanPosition).toBe(
      visibleLessonSteps(asset)[2].position - 1,
    );
    expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
    await page.reload();
    await expectStep(page, 3);
  } finally {
    await context.close();
  }
});
