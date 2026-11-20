import { afterAll, beforeAll, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { type Browser, chromium } from '@playwright/test';
import { renderToStaticMarkup } from 'react-dom/server';
import { LessonSlideShell } from '../src/fundamentals/learner/LessonSlideShell';
import type { LessonStep } from '../src/fundamentals/delivery/slideTypes';

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});
const css = [
  'src/style.css',
  'src/fundamentals/learner/learner.css',
  'src/fundamentals/learner/learner-responsive.css',
]
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const step: LessonStep = {
  id: 'layout-unit',
  kind: 'reading',
  style: 'normal',
  unitId: 'layout',
  objectiveIds: [],
  label: 'Reading',
  blocks: [],
  sources: [],
  estimatedSeconds: 20,
  position: 2,
  totalSteps: 20,
  remainingSteps: 18,
};

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 700 },
  { width: 844, height: 390 },
]) {
  for (const adHeight of [0, 300, 900]) {
    test(`component unit: ${adHeight}px ad preserves controller at ${viewport.width}x${viewport.height}`, async () => {
      const page = await browser.newPage({ viewport });
      try {
        const html = renderToStaticMarkup(
          <LessonSlideShell
            step={step}
            unitTitle="Unit"
            catalogHref="/catalog/"
            onCatalog={() => {}}
            previousHref="/previous/"
            onPrevious={() => {}}
            onNext={() => {}}
            adSlot={
              adHeight ? (
                <div data-unit-ad style={{ height: adHeight }}>
                  Ad component input
                </div>
              ) : undefined
            }
          >
            <p>Read this lesson before continuing.</p>
          </LessonSlideShell>,
        );
        await page.setContent(
          `<html lang="en"><head><style>${css}</style></head><body>${html}</body></html>`,
        );
        const metrics = await page.evaluate(() => {
          const footer = document.querySelector<HTMLElement>('.lesson-slide-actions');
          const previous = document.querySelector<HTMLElement>('.lesson-slide-action');
          const next = document.querySelector<HTMLElement>('.lesson-slide-actions > button.primary');
          const stage = document.querySelector<HTMLElement>('.lesson-slide-stage');
          const ad = document.querySelector<HTMLElement>('[data-unit-ad]');
          if (!footer || !previous || !next || !stage)
            throw new Error('Missing actual component nodes.');
          const controls = [previous, next, footer.querySelector<HTMLElement>('.lesson-slide-exit')];
          const bounds = footer.getBoundingClientRect();
          return {
            footerBottom: bounds.bottom,
            documentHeight: document.documentElement.scrollHeight,
            footerTop: bounds.top,
            stageHeight: stage.clientHeight,
            equalWidth: Math.abs(
              previous.getBoundingClientRect().width - next.getBoundingClientRect().width,
            ),
            equalHeight: Math.abs(
              previous.getBoundingClientRect().height - next.getBoundingClientRect().height,
            ),
            previousBorder: getComputedStyle(previous).borderTopStyle,
            adHeight: ad?.getBoundingClientRect().height ?? 0,
            adInsideStage: !ad || stage.contains(ad),
            controlsReachable: controls.every((control) => {
              if (!control) return false;
              const rect = control.getBoundingClientRect();
              return (
                rect.top >= 0 &&
                rect.bottom <= innerHeight &&
                rect.width >= 44 &&
                rect.height >= 44 &&
                control.contains(
                  document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
                )
              );
            }),
          };
        });
        expect(metrics.footerBottom).toBeLessThanOrEqual(viewport.height);
        expect(metrics.documentHeight).toBeLessThanOrEqual(viewport.height);
        expect(metrics.footerTop).toBeGreaterThanOrEqual(0);
        expect(metrics.stageHeight).toBeGreaterThan(0);
        expect(metrics.controlsReachable).toBe(true);
        expect(metrics.equalWidth).toBeLessThanOrEqual(1);
        expect(metrics.equalHeight).toBeLessThanOrEqual(1);
        expect(metrics.previousBorder).toBe('solid');
        expect(metrics.adHeight).toBe(adHeight);
        expect(metrics.adInsideStage).toBe(true);
      } finally {
        await page.close();
      }
    });
  }
}
