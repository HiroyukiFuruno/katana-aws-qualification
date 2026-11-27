import { expect, test } from '@playwright/test';
import { lessonPath } from '../../src/fundamentals/delivery/navigation';
import { messages } from '../../src/messages';
import { lessonAssets, selectLessonAnswer, visibleLessonSteps } from './fundamentals.helpers';
import { acceptNecessaryCookies } from './fundamentals-mobile.helpers';

test('Japanese deployment slides use natural headings and explain the canary example', async ({
  page,
}) => {
  const asset = lessonAssets.find(({ unit }) => unit.id === 'fundamentals.release-rollback');
  if (!asset) throw new Error('Missing release lesson fixture.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(lessonPath({ locale: 'ja', unitId: asset.unit.id, stage: 'resume' }));
  await acceptNecessaryCookies(page);
  const visible = visibleLessonSteps(asset);
  const misconception = visible.findIndex((step) => step.kind === 'misconception');
  for (const _ of visible.slice(0, misconception))
    await page.locator('.lesson-slide-actions > button.primary').click();
  await expect(page.getByRole('heading', { level: 1, name: 'よくある誤解' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '誤解の例' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '正しい考え方' })).toBeVisible();
  await expect(page.locator('.lesson-reading')).toContainText(
    '新環境で書き込んだデータを旧版が扱えなければ',
  );
  const example = visible.findIndex(
    (step) => step.kind === 'example' && step.sectionId === 'observation-abort',
  );
  for (const step of visible.slice(misconception, example)) {
    if (step.kind === 'checkpoint') {
      const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
      if (!question) throw new Error('Missing checkpoint fixture.');
      await selectLessonAnswer(page, question, question.correct);
      await page.getByRole('button', { name: messages.ja.lessonCheckpointSubmit, exact: true }).click();
    }
    await page.locator('.lesson-slide-actions > button.primary').click();
  }
  await expect(page.locator('.lesson-reading')).toContainText(
    'カナリアデプロイ中に、新版の応答時間（p95）が基準を超えた。',
  );
  await expect(page.locator('.lesson-reading')).not.toContainText('新版本');
});
