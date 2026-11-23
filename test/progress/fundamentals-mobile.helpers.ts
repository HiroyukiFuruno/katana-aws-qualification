import { expect, type Page } from '@playwright/test';
import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';
import { nextButton, selectLessonAnswer } from './fundamentals.helpers';

export async function acceptNecessaryCookies(page: Page) {
  const banner = page.locator('.cookie-banner');
  const savedChoice = await page.evaluate(() => localStorage.getItem('katana-aws:cookie-consent'));
  if (savedChoice !== 'granted' && savedChoice !== 'denied') {
    await banner.getByRole('button', { name: '必要なもののみ', exact: true }).click();
  }
  await expect(banner).toBeHidden();
}

export async function assertReadingGeometry(
  page: Page,
  step: DeliveryUnitAsset['steps'][number],
  asset: DeliveryUnitAsset,
) {
  await expect(page).toHaveURL(new RegExp(`${stepHref('ja', step, asset)}$`));
  await expect(page.locator('.lesson-slide-meta')).toContainText(
    `STEP ${step.position} / ${asset.totalSteps}`,
  );
  await expect(page.locator('.lesson-slide-meta')).toContainText(`残り${step.remainingSteps}ステップ`);
  const metrics = await page.locator('.lesson-slide-shell').evaluate((shell) => {
    const stage = shell.querySelector<HTMLElement>('.lesson-slide-stage');
    const content = shell.querySelector<HTMLElement>('.lesson-slide-content');
    const controls = [...shell.querySelectorAll<HTMLElement>('button, a')];
    if (!stage || !content) throw new Error('Missing lesson geometry nodes.');
    window.scrollTo(0, document.documentElement.scrollHeight);
    const contentRect = content.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      contentReachable: contentRect.bottom <= innerHeight + 2,
      stageUsesPageScroll: getComputedStyle(stage).overflowY === 'visible',
      controls: controls.map((control) => ({
        width: control.getBoundingClientRect().width,
        height: control.getBoundingClientRect().height,
      })),
    };
  });
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.contentReachable).toBe(true);
  expect(metrics.stageUsesPageScroll).toBe(true);
  expect(metrics.controls.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
}

export async function walkReadingWithGeometry(page: Page, asset: DeliveryUnitAsset) {
  for (const step of asset.steps.filter((candidate) => candidate.kind !== 'final')) {
    await assertReadingGeometry(page, step, asset);
    if (step.kind === 'checkpoint') {
      const question = asset.checkpoints.find((candidate) => candidate.id === step.assessmentId);
      if (!question) throw new Error('Missing checkpoint fixture.');
      await selectLessonAnswer(page, question, question.correct);
      await page.getByRole('button', { name: '回答を確認', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('正解');
    }
    await expect(nextButton(page)).toBeEnabled();
    await nextButton(page).click();
  }
}
