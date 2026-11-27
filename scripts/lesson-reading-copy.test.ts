import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import type { DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import { lessonReadingCopy } from '../src/fundamentals/delivery/lessonReadingCopy';
import { type Locale, locales } from '../src/locales';

async function deliveryUnit(locale: Locale, slug = 'release-rollback') {
  const root = locale === 'ja' ? 'public' : `public/translations/${locale}`;
  return JSON.parse(
    await readFile(`${root}/fundamentals/delivery/${slug}.json`, 'utf8'),
  ) as DeliveryUnitAsset;
}

test('Japanese release copy replaces misleading wording while preserving step and question identities', async () => {
  const asset = await deliveryUnit('ja');
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
    const asset = await deliveryUnit(locale);
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
  const data = await deliveryUnit('it', 'networking-basics');
  const step = data.steps[9];
  const fixed = lessonReadingCopy(step, 'it');
  expect(fixed.blocks.at(-2)?.text).toBe(step.blocks.at(-2)?.label);
  expect(fixed.blocks.at(-1)?.text).toBe(step.blocks.at(-2)?.text);
  expect(lessonReadingCopy(fixed, 'it')).toBe(fixed);
});

test('all nine translations restore a final paragraph with a swapped heading and body', async () => {
  for (const locale of locales.filter((item) => item !== 'ja')) {
    const asset = await deliveryUnit(locale, 'cloud-concepts');
    const onDemand = asset.steps.find(
      (step) => step.sectionId === 'on-demand' && step.kind === 'reading',
    );
    if (!onDemand) throw new Error(`Missing on-demand reading for ${locale}`);
    const fixed = lessonReadingCopy(onDemand, locale);
    expect(fixed.blocks[0]).toEqual(onDemand.blocks[0]);
    expect(fixed.blocks[1].text).toBe(onDemand.blocks[1].label);
    expect(fixed.blocks[1].label).toBe(onDemand.blocks[1].text);
    expect(lessonReadingCopy(fixed, locale)).toBe(fixed);
  }
});

test('all nine translations keep the IAM role definition when replacing the heading', async () => {
  for (const locale of locales.filter((item) => item !== 'ja')) {
    const asset = await deliveryUnit(locale, 'identity-access');
    const step = asset.steps.find((item) => item.id.endsWith(':principal-role:concept:1'));
    if (!step) throw new Error(`Missing IAM role slide for ${locale}`);
    const fixed = lessonReadingCopy(step, locale);
    expect(fixed.label).not.toBe(step.label);
    expect(fixed.blocks.map((block) => block.text)).toEqual([
      step.blocks[0].text,
      step.blocks[1].label,
      step.blocks[1].text,
    ]);
  }
});

test('all nine translations retain the CI/CD approval and artifact objectives', async () => {
  for (const locale of locales.filter((item) => item !== 'ja')) {
    const asset = await deliveryUnit(locale, 'cicd');
    const step = asset.steps.find((item) => item.id.endsWith(':intro:objectives:1'));
    if (!step) throw new Error(`Missing CI/CD objectives slide for ${locale}`);
    expect(lessonReadingCopy(step, locale).blocks.map((block) => block.text)).toEqual([
      step.blocks[0].text,
      step.blocks[1].label,
      step.blocks[1].text,
    ]);
  }
});
