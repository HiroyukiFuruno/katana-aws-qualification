import { expect, type Page } from '@playwright/test';
import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { stepHref } from '../../src/fundamentals/delivery/planNavigation';
import { lessonSlidePresentation } from '../../src/fundamentals/learner/lessonSlidePresentation';
import { localeForPath } from '../../src/locales';
import { messages } from '../../src/messages';
import { nextButton, selectLessonAnswer, visibleLessonSteps } from './fundamentals.helpers';

export async function acceptNecessaryCookies(page: Page) {
  const banner = page.locator('.cookie-banner');
  const savedChoice = await page.evaluate(() => localStorage.getItem('katana-aws:cookie-consent'));
  if (savedChoice !== 'granted' && savedChoice !== 'denied') {
    const locale = localeForPath(new URL(page.url()).pathname);
    await banner.getByRole('button', { name: messages[locale].cookieNecessary, exact: true }).click();
  }
  await expect(banner).toBeHidden();
}

export async function assertReadingGeometry(
  page: Page,
  step: DeliveryUnitAsset['steps'][number],
  asset: DeliveryUnitAsset,
) {
  const { display } = lessonSlidePresentation(asset.steps, step);
  await expect(page).toHaveURL(new RegExp(`${stepHref('ja', step, asset)}$`));
  await expect(page.locator('.lesson-slide-meta')).toContainText(
    `STEP ${display.position} / ${display.totalSteps}`,
  );
  await expect(page.locator('.lesson-slide-meta')).toContainText(
    `残り${display.remainingSteps}ステップ`,
  );
  const metrics = await page.locator('.lesson-slide-shell').evaluate((shell) => {
    const stage = shell.querySelector<HTMLElement>('.lesson-slide-stage');
    const content = shell.querySelector<HTMLElement>('.lesson-slide-content');
    const controls = [...shell.querySelectorAll<HTMLElement>('button, a, summary')].filter(
      (control) => control.getClientRects().length > 0,
    );
    if (!stage || !content) throw new Error('Missing lesson geometry nodes.');
    window.scrollTo(0, document.documentElement.scrollHeight);
    const contentRect = content.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
      contentReachable: contentRect.bottom <= innerHeight + 2,
      stageUsesPageScroll: getComputedStyle(stage).overflowY === 'visible',
      controls: controls.map((control) => ({
        label: control.textContent?.trim() || control.getAttribute('href'),
        width: control.getBoundingClientRect().width,
        height: control.getBoundingClientRect().height,
      })),
    };
  });
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.contentReachable).toBe(true);
  expect(metrics.stageUsesPageScroll).toBe(true);
  expect(metrics.controls.filter(({ width, height }) => width < 44 || height < 44)).toEqual([]);
}

export async function walkReadingWithGeometry(page: Page, asset: DeliveryUnitAsset) {
  for (const step of visibleLessonSteps(asset).filter((candidate) => candidate.kind !== 'final')) {
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
