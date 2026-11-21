import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { DeliveryUnitAsset } from '../../src/fundamentals/delivery/artifactTypes';
import { parseDeliveryIndex } from '../../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../../src/fundamentals/delivery/loadUnit';

const root = new URL('../../public/fundamentals/delivery/', import.meta.url);
const index = parseDeliveryIndex(JSON.parse(readFileSync(new URL('index.json', root), 'utf8')));
const cases = [
  ['cloud-concepts', 'tradeoffs', 2, false],
  ['routing-connectivity', 'route-selection', 1, false],
  ['routing-connectivity', 'internet-egress', 2, false],
  ['observability', 'objectives', 2, false],
  ['cloud-concepts', 'tradeoffs', 2, true],
] as const;

function fixture(slug: string): DeliveryUnitAsset {
  const entry = index.units.find((unit) => unit.slug === slug);
  if (!entry) throw new Error(`Missing published unit: ${slug}`);
  return parseDeliveryUnit(JSON.parse(readFileSync(new URL(`${slug}.json`, root), 'utf8')), entry);
}

for (const [slug, section, position, repeat] of cases) {
  const asset = fixture(slug);
  const id = `${asset.unit.id}:section:${section}:concept:${position}`;
  const target = asset.steps.find((step) => step.id === id);
  if (target && repeat) target.blocks = [...target.blocks, target.blocks[0]];
  const adjacent = asset.steps.find(
    (step) => step.blocks.length && step.sectionId && step.sectionId !== target?.sectionId,
  );
  if (!target || !adjacent) throw new Error(`Missing reading step: ${id}`);
  expect(new Set(target.blocks.map((block) => block.contentRef)).size).toBeLessThan(
    target.blocks.length,
  );
  for (const renderer of ['reading', 'related']) {
    test(`${slug}/${section}/${repeat ? 'repeat' : 'published'}: ${renderer} retains split fragments across updates`, async ({
      page,
    }) => {
      const warnings: string[] = [];
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && message.text().includes('same key'))
          warnings.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      const params = new URLSearchParams({
        unit: asset.unit.id,
        step: id,
        renderer,
        repeat: String(repeat),
      });
      await page.goto(`/test/glossary/lesson-fragment-keys-browser.html?${params}`);
      const main = page.locator('main');
      const paragraphs =
        renderer === 'reading'
          ? main.locator('.lesson-reading-block > p')
          : main.locator('.lesson-related-content > section > p');
      const expected = (step: typeof target) =>
        (renderer === 'reading'
          ? step.blocks
          : asset.steps
              .filter(
                (reading) =>
                  reading.kind !== 'checkpoint' &&
                  reading.kind !== 'final' &&
                  reading.sectionId === step.sectionId,
              )
              .flatMap((reading) => reading.blocks)
        ).map((block) => block.text);
      if (renderer === 'related') await page.locator('summary').click();
      await expect(main).toHaveAttribute('data-step', target.id);
      await expect(paragraphs).toHaveText(expected(target));
      await page.getByRole('button', { name: 'Rerender', exact: true }).click();
      await expect(main).toHaveAttribute('data-revision', '1');
      await expect(paragraphs).toHaveText(expected(target));
      await page.getByRole('button', { name: 'Adjacent step', exact: true }).click();
      await expect(main).toHaveAttribute('data-step', adjacent.id);
      await expect(paragraphs).toHaveText(expected(adjacent));
      await page.getByRole('button', { name: 'Target step', exact: true }).click();
      await expect(main).toHaveAttribute('data-step', target.id);
      await expect(paragraphs).toHaveText(expected(target));
      expect(errors).toEqual([]);
      expect(warnings).toEqual([]);
    });
  }
}
