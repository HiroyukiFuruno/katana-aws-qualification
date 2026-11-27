import { expect, test } from '@playwright/test';
import lessonFigures from '../../src/fundamentals/delivery/lesson-figures.json' with { type: 'json' };
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
    '更新版が書いたデータを以前の版が読めない場合は復旧できません',
  );
  const example = visible.findIndex(
    (step) => step.kind === 'example' && step.sectionId === 'observation-abort',
  );
  for (const step of visible.slice(misconception, example)) {
    if (step.kind === 'takeaway' && step.sectionId === 'deployment-strategies') {
      const sources = page.locator('.lesson-reading-sources');
      await sources.locator('summary').click();
      const reference = sources.getByRole('link', { name: 'Amazon ECS のデプロイ方式とコントローラー' });
      await expect(reference).toHaveAttribute(
        'href',
        'https://docs.aws.amazon.com/ja_jp/AmazonECS/latest/developerguide/ecs_service-options.html',
      );
      await expect(reference).toHaveAttribute('hreflang', 'ja');
    }
    if (step.kind === 'checkpoint') {
      const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
      if (!question) throw new Error('Missing checkpoint fixture.');
      await selectLessonAnswer(page, question, question.correct);
      await page.getByRole('button', { name: messages.ja.lessonCheckpointSubmit, exact: true }).click();
    }
    await page.locator('.lesson-slide-actions > button.primary').click();
  }
  await expect(page.locator('.lesson-reading')).toContainText(
    '更新版へのリクエストを5%にした後、更新版の注文完了率が事前に決めた下限を割りました。',
  );
  await expect(page.locator('.lesson-reading')).not.toContainText('新版本');
});

test('lesson recovery actions fit and have breathing room on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/ja/study/fundamentals/');
  await acceptNecessaryCookies(page);
  const firstLesson = page.locator('.lesson-catalog-card a').first();
  await expect(firstLesson).toBeVisible();
  await page.context().setOffline(true);
  try {
    await firstLesson.click();
    await expect(page.getByRole('alert')).toHaveText(messages.ja.fundamentalsLoadError);
    const actions = page.locator('.lesson-recovery-actions');
    await expect(actions.getByRole('button', { name: messages.ja.fundamentalsReload })).toBeVisible();
    await expect(actions.getByRole('link')).toBeVisible();
    await expect(actions).toHaveCSS('column-gap', '16px');
    expect(await actions.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  } finally {
    await page.context().setOffline(false);
  }
});

for (const [stepId, figure] of Object.entries(lessonFigures)) {
  for (const locale of ['ja', 'de'] as const) {
    test(`${locale}: lesson diagrams use shared English assets at ${stepId}`, async ({ page }) => {
      const unitId = stepId.split(':')[0];
      const asset = lessonAssets.find(({ unit }) => unit.id === unitId);
      if (!asset) throw new Error(`Missing public lesson: ${unitId}`);
      const steps = visibleLessonSteps(asset);
      const target = steps.findIndex(({ id }) => id === stepId);
      if (target < 0) throw new Error(`Missing public slide: ${stepId}`);
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto(lessonPath({ locale, unitId, stage: 'resume' }));
      await acceptNecessaryCookies(page);
      for (const step of steps.slice(0, target)) {
        if (step.kind === 'checkpoint') {
          const question = asset.checkpoints.find((item) => item.id === step.assessmentId);
          if (!question) throw new Error(`Missing checkpoint: ${step.id}`);
          await selectLessonAnswer(page, question, question.correct);
          await page
            .getByRole('button', { name: messages[locale].lessonCheckpointSubmit, exact: true })
            .click();
        }
        await page.locator('.lesson-slide-actions > button.primary').click();
      }

      const diagram = page.locator('.lesson-reading .lesson-figure');
      const image = diagram.getByRole('img');
      await expect(diagram).toHaveAttribute('lang', 'en');
      await expect(image).toHaveAttribute('src', figure.url);
      await expect(image).toHaveAttribute('alt', figure.alt);
      await expect
        .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
        .toBeGreaterThan(0);
      await expect(image).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

      if (locale === 'ja' && unitId === 'fundamentals.cidr-subnets') {
        const glossary = page.waitForEvent('popup');
        await page
          .locator('.lesson-glossary-links')
          .getByRole('link', { name: 'Subnet', exact: true })
          .click();
        const popup = await glossary;
        await expect(popup).toHaveURL(/\/ja\/glossary\/#glossary-term-subnet$/);
        await expect(popup.locator('#glossary-term-subnet')).toBeInViewport();
        await popup.close();
        await expect(image).toBeVisible();
      }
    });
  }
}
