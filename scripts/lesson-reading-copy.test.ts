import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import type { DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonReadingCopy } from '../src/fundamentals/delivery/lessonReadingCopy';
import { type Locale, locales } from '../src/locales';

async function deployment(locale: Locale) {
  const root = locale === 'ja' ? 'public' : `public/translations/${locale}`;
  return JSON.parse(
    await readFile(`${root}/fundamentals/delivery/release-rollback.json`, 'utf8'),
  ) as DeliveryUnitAsset;
}

test('Japanese release copy replaces misleading wording while preserving step and question identities', async () => {
  const asset = await deployment('ja');
  const copy = asset.steps.map((step) => lessonReadingCopy(step, 'ja'));
  expect(copy.map((step) => step.id)).toEqual(asset.steps.map((step) => step.id));
  expect(copy.filter((step) => step.kind === 'misconception').map((step) => step.label)).toEqual(
    Array(4).fill('よくある誤解'),
  );
  const body = copy.flatMap((step) => step.blocks.map((block) => block.text));
  expect(body).toContain('カナリアデプロイ中に、新版の応答時間（p95）が基準を超えた。');
  expect(body.join('')).not.toMatch(/新版本|\btraffic\b|\blatency\b/);
  expect(asset.steps.flatMap((step) => step.blocks.map((block) => block.text)).join('')).toContain(
    '新版本',
  );
});

test('all nine translations keep the two monitoring paragraphs and outcome in their body fields', async () => {
  for (const locale of locales.filter((item) => item !== 'ja')) {
    const asset = await deployment(locale);
    const reading = asset.steps[10];
    const outcome = asset.steps[6];
    expect(reading.sectionId).toBe('observation-abort');
    const repaired = lessonReadingCopy(reading, locale);
    expect(repaired.blocks[1].text).toBe(reading.blocks[1].label);
    expect(repaired.blocks[2].text).toBe(reading.blocks[1].text);
    expect(repaired.blocks[1].label).toBe(reading.label);
    expect(lessonReadingCopy(outcome, locale).blocks[1].text).toBe(outcome.blocks[1].label);
  }
});

test('a chapter outside deployment also recovers a paragraph stored in a heading', async () => {
  const data = JSON.parse(
    await readFile('public/translations/it/fundamentals/delivery/networking-basics.json', 'utf8'),
  ) as DeliveryUnitAsset;
  const step = data.steps[9];
  const fixed = lessonReadingCopy(step, 'it');
  expect(fixed.blocks.at(-2)?.text).toBe(step.blocks.at(-2)?.label);
  expect(fixed.blocks.at(-1)?.text).toBe(step.blocks.at(-2)?.text);
  expect(lessonReadingCopy(fixed, 'it')).toBe(fixed);
});
