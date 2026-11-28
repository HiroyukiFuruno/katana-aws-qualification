import { expect, test } from '@playwright/test';
import lessonFigures from '../../src/fundamentals/delivery/lesson-figures.json' with { type: 'json' };

test('shared responsibility comparison keeps all labels within the mobile SVG', async ({ page }) => {
  const figure = lessonFigures['fundamentals.cloud-concepts:section:shared-responsibility:concept:1'];
  await page.setViewportSize({ width: 320, height: 700 });
  const response = await page.goto(figure.url);
  expect(response?.ok()).toBe(true);

  await expect(page.locator('svg foreignObject')).toHaveCount(0);
  const labels = page.locator('svg text');
  await expect(labels).toHaveText([
    'Amazon EC2',
    'Amazon S3',
    'Customer responsibilities',
    'Both: protect data and manage access',
    'Patch the guest OS',
    'Configure applications',
    'Set bucket permissions',
    'Choose data encryption',
    'AWS responsibilities',
    'Run the physical host',
    'Manage the hypervisor',
    'Run the service OS',
    'Manage storage systems',
  ]);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await labels.evaluateAll((elements) =>
      elements.every((element) => {
        if (!(element instanceof SVGTextElement) || !element.ownerSVGElement) return false;
        const bounds = element.getBBox();
        const view = element.ownerSVGElement.viewBox.baseVal;
        return (
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.x >= view.x &&
          bounds.y >= view.y &&
          bounds.x + bounds.width <= view.x + view.width &&
          bounds.y + bounds.height <= view.y + view.height
        );
      }),
    ),
  ).toBe(true);
});
