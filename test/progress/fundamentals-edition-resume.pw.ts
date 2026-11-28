import { expect, test } from '@playwright/test';
import legacyRecordAssets from '../../src/fundamentals/delivery/legacyRecordAssets.json' with {
  type: 'json',
};
import { readLessonRecordAsset } from '../../src/fundamentals/delivery/recordAsset';
import { lessonQuestionRef } from '../../src/fundamentals/state/grade';
import {
  saveGuestLessonResponse,
  startGuestLessonFinal,
  submitGuestLessonFinal,
} from '../../src/fundamentals/state/guestFinal';
import { initialGuestLesson } from '../../src/fundamentals/state/guestInitial';
import { recordGuestLessonStep } from '../../src/fundamentals/state/guestStep';
import { lessonAssets, lessonPrefix } from './fundamentals.helpers';

const legacy = legacyRecordAssets.assets[0];
if (!legacy) throw new Error('Missing legacy lesson fixture');
const current = lessonAssets.find((asset) => asset.unit.id === legacy.unit.id);
if (!current) throw new Error('Missing current lesson fixture for the legacy unit');
const archivedAsset = readLessonRecordAsset(legacy, legacy.unit.id, legacy.contentVersion);
if (current.contentVersion === archivedAsset.contentVersion) {
  throw new Error('Legacy and current lesson versions must differ.');
}
const archivedKey = `${lessonPrefix}${archivedAsset.unit.id}.${archivedAsset.contentVersion}`;
const currentKey = `${lessonPrefix}${current.unit.id}.${current.contentVersion}`;
const currentHref = `/ja/study/fundamentals/${current.unit.id.replace('fundamentals.', '')}/`;

function archivedGuestFinal(submitted: boolean) {
  let source = initialGuestLesson(archivedAsset);
  const time = new Date().toISOString();
  for (const step of archivedAsset.steps.filter((step) => step.kind !== 'final')) {
    const question = archivedAsset.checkpoints.find((question) => question.id === step.assessmentId);
    source = recordGuestLessonStep(
      source,
      archivedAsset,
      step.id,
      question
        ? {
            selected: question.correct,
            receiptId: crypto.randomUUID(),
            answeredAt: time,
            durationMs: 20,
          }
        : undefined,
    ).source;
  }
  const session = crypto.randomUUID();
  source = startGuestLessonFinal(source, archivedAsset, session, time);
  for (const [position, question] of archivedAsset.finalQuestions.entries()) {
    source = saveGuestLessonResponse(
      source,
      archivedAsset,
      session,
      position,
      {
        questionRef: lessonQuestionRef(question),
        selected: question.correct,
        selectedAt: time,
        durationMs: 20,
      },
      position,
    );
  }
  return submitted
    ? submitGuestLessonFinal(
        source,
        archivedAsset,
        session,
        time,
        Array.from({ length: 12 }, () => crypto.randomUUID()),
      )
    : source;
}

for (const submitted of [false, true]) {
  test(`an archived ${submitted ? 'result' : 'draft'} stays unchanged while its old URL opens the current lesson`, async ({
    page,
  }) => {
    const raw = JSON.stringify(archivedGuestFinal(submitted));
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/ja/study/fundamentals/');
    await page.getByRole('button', { name: '必要なもののみ', exact: true }).click();
    await page.getByLabel('ゲストの学習記録をこの端末に保存する').check();
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: archivedKey,
      value: raw,
    });
    await page.reload();

    const archive = page.locator('.lesson-archived-records');
    await expect(archive).toBeVisible();
    await archive.locator('summary').click();
    if (submitted) {
      await expect(archive).toContainText('合格');
      await expect(archive).toContainText('得点: 12 / 12');
    } else {
      await expect(archive).toContainText('最終問題を受験中');
    }

    await page.goto(`${currentHref}?version=${archivedAsset.contentVersion}`);
    await expect(page).toHaveURL(`${currentHref}slides/1/`);
    await expect(page.locator('.lesson-slide-meta')).toBeVisible();
    await expect(page.locator('.lesson-result-pass')).toHaveCount(0);
    await expect(page.locator('fieldset input:checked')).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), archivedKey)).toBe(raw);
    expect(await page.evaluate((key) => localStorage.getItem(key), currentKey)).toBeNull();

    await page.getByRole('button', { name: '学習を終了', exact: true }).click();
    await archive.locator('summary').click();
    const resume = archive.getByRole('link', { name: '学習を続ける', exact: true });
    await expect(resume).toHaveAttribute('href', currentHref);
    await resume.click();
    await expect(page.locator('.lesson-slide-meta')).toBeVisible();
    await expect(page).toHaveURL(`${currentHref}slides/1/`);
    expect(new URL(page.url()).search).toBe('');
    expect(await page.evaluate((key) => localStorage.getItem(key), archivedKey)).toBe(raw);
    expect(await page.evaluate((key) => localStorage.getItem(key), currentKey)).toBeNull();
  });
}
