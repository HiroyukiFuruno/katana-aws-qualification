import { expect, test } from 'bun:test';
import { validFundamentalsContent } from '../src/fundamentals/content';
import { overlayFundamentalsContent } from '../src/fundamentals/contentLocalization';
import type { DeliveryIndexAsset, DeliveryUnitAsset } from '../src/fundamentals/delivery/artifactTypes';
import {
  type Fetcher,
  loadDeliveryIndex,
  parseDeliveryIndex,
} from '../src/fundamentals/delivery/loadIndex';
import { loadDeliveryUnit, parseDeliveryUnit } from '../src/fundamentals/delivery/loadUnit';
import { overlayDeliveryIndex, overlayDeliveryUnit } from '../src/fundamentals/delivery/localize';
import { verifyTrustedDeliveryUnit } from '../src/fundamentals/delivery/trusted';
import { finalPresentation } from '../src/fundamentals/learner/lesson-presentation';
import type { FundamentalsContent } from '../src/fundamentals/types';
import { locales } from '../src/locales';

const index = (await Bun.file('public/fundamentals/delivery/index.json').json()) as DeliveryIndexAsset;
const entry = index.units[0];
if (!entry) throw new Error('Missing fundamentals delivery index entry.');
const unit = (await Bun.file(
  `public/fundamentals/delivery/${entry.slug}.json`,
).json()) as DeliveryUnitAsset;
const trusted = await Bun.file('public/fundamentals/delivery/trustedCatalog.json').json();
const content = (await Bun.file('public/fundamentals/content.json').json()) as FundamentalsContent;

test('localized narrative overlays preserve delivery identity and canonical answers', () => {
  const localizedIndex = structuredClone(index);
  const localizedUnit = structuredClone(unit);
  localizedIndex.units[0].title = 'Localized unit';
  localizedIndex.units[0].objective = 'Localized objective';
  localizedUnit.unit.title = 'Localized unit';
  localizedUnit.steps[0].label = 'Localized slide';
  localizedUnit.steps[0].blocks[0].text = 'Localized text';
  localizedUnit.finalQuestions[0].prompt = 'Localized final question';
  localizedUnit.finalQuestions[0].choices[0].text = 'Localized choice';
  localizedUnit.finalQuestions[0].choices[0].explanation = 'Localized explanation';

  const catalog = overlayDeliveryIndex(index, localizedIndex);
  const asset = overlayDeliveryUnit(unit, localizedUnit);

  expect(catalog.units[0].title).toBe('Localized unit');
  expect(asset.steps[0].blocks[0].text).toBe('Localized text');
  expect(asset.finalQuestions[0].choices[0].id).toBe(unit.finalQuestions[0].choices[0].id);
  expect(asset.finalQuestions[0].correct).toEqual(unit.finalQuestions[0].correct);
  expect(asset.contentHash).toBe(unit.contentHash);
});

test('localized source content preserves fundamentals question identities', () => {
  const localized = structuredClone(content);
  localized.catalog[0].title = 'Localized catalog';
  localized.units[0].learningObjectives[0].text = 'Localized objective';
  localized.units[0].sections[0].paragraphs[0] = 'Localized section';
  localized.units[0].questions[0].choices[0].text = 'Localized choice';
  const result = overlayFundamentalsContent(content, localized);
  expect(result.catalog[0].title).toBe('Localized catalog');
  expect(result.units[0].questions[0].choices[0].id).toBe(content.units[0].questions[0].choices[0].id);
  expect(result.units[0].questions[0].correct).toEqual(content.units[0].questions[0].correct);
});

test('localized overlays reject a changed canonical identity', () => {
  const localized = structuredClone(unit);
  localized.finalQuestions[0].choices[0].id = 'changed-choice';
  expect(() => overlayDeliveryUnit(unit, localized)).toThrow('identity changed');
});

test('a missing localized index is a load error instead of a Japanese fallback', async () => {
  const fetcher: Fetcher = async (path) =>
    String(path) === '/fundamentals/delivery/index.json'
      ? new Response(JSON.stringify(index))
      : new Response(null, { status: 404 });
  await expect(loadDeliveryIndex({ fetcher, locale: 'en' })).rejects.toThrow(
    'Delivery asset request failed: 404',
  );
});

test('trusted catalog validates the base artifact before localization', () => {
  verifyTrustedDeliveryUnit(trusted, unit);
  const altered = structuredClone(unit);
  altered.finalQuestions[0].correct = ['not-a-choice'];
  expect(() => verifyTrustedDeliveryUnit(trusted, altered)).toThrow('Untrusted lesson delivery asset');
});

test('base trust validation runs before requesting a localized unit overlay', async () => {
  const altered = structuredClone(unit);
  altered.finalQuestions[0].correct = [altered.finalQuestions[0].choices[1].id];
  let localizedRequested = false;
  const fetcher: Fetcher = async (path) => {
    const value = String(path);
    if (value.includes('/translations/')) localizedRequested = true;
    if (value.endsWith(`${entry.slug}.json`)) return new Response(JSON.stringify(altered));
    if (value.endsWith('/trustedCatalog.json')) return new Response(JSON.stringify(trusted));
    return new Response(null, { status: 404 });
  };
  await expect(loadDeliveryUnit(index, entry.unitId, { fetcher, locale: 'en' })).rejects.toThrow(
    'Untrusted lesson delivery asset',
  );
  expect(localizedRequested).toBe(false);
});

test('every non-Japanese translation overlays current delivery assets', async () => {
  const basePath = '/fundamentals/delivery';
  for (const locale of locales.filter((locale) => locale !== 'ja')) {
    const localizedContent = await Bun.file(
      `public/translations/${locale}/fundamentals/content.json`,
    ).json();
    expect(validFundamentalsContent(localizedContent)).toBe(true);
    expect(() =>
      overlayFundamentalsContent(content, localizedContent as FundamentalsContent),
    ).not.toThrow();
    const baseIndex = parseDeliveryIndex(await Bun.file(`public${basePath}/index.json`).json());
    const localizedIndex = parseDeliveryIndex(
      await Bun.file(`public/translations/${locale}${basePath}/index.json`).json(),
    );
    expect(() => overlayDeliveryIndex(baseIndex, localizedIndex)).not.toThrow();
    for (const entry of baseIndex.units) {
      const baseUnit = parseDeliveryUnit(
        await Bun.file(`public${basePath}/${entry.slug}.json`).json(),
        entry,
      );
      const localizedUnit = parseDeliveryUnit(
        await Bun.file(`public/translations/${locale}${basePath}/${entry.slug}.json`).json(),
        entry,
      );
      expect(() => overlayDeliveryUnit(baseUnit, localizedUnit)).not.toThrow();
    }
  }
});

test('final presentation is deterministic per session and preserves canonical ids', () => {
  const first = finalPresentation(unit, 'f3ebd9b4-75d2-44ce-929b-29d48022cb8f');
  const second = finalPresentation(unit, 'f3ebd9b4-75d2-44ce-929b-29d48022cb8f');
  expect(second).toEqual(first);
  expect(first.map(({ canonicalPosition }) => canonicalPosition).sort((a, b) => a - b)).toEqual(
    Array.from({ length: unit.finalQuestions.length }, (_, position) => position),
  );
  for (const { canonicalPosition, question } of first) {
    expect(question.id).toBe(unit.finalQuestions[canonicalPosition].id);
    expect(question.choices.map((choice) => choice.id).sort()).toEqual(
      unit.finalQuestions[canonicalPosition].choices.map((choice) => choice.id).sort(),
    );
  }
});
