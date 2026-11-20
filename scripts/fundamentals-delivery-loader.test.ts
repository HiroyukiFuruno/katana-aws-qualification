import { expect, test } from 'bun:test';
import { parseDeliveryIndex } from '../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../src/fundamentals/delivery/loadUnit';

test('strict delivery loaders accept every generated unit and preserve catalog metadata', async () => {
  const index = parseDeliveryIndex(await Bun.file('public/fundamentals/delivery/index.json').json());
  expect(index.units).toHaveLength(12);
  for (const entry of index.units) {
    const asset = parseDeliveryUnit(
      await Bun.file(`public/fundamentals/delivery/${entry.slug}.json`).json(),
      entry,
    );
    expect(asset.contentVersion).toBe(entry.contentVersion);
    expect(asset.steps).toHaveLength(entry.totalSteps);
    expect(entry.parent).toBeString();
    expect(entry.objective).toBeString();
    expect(entry.order).toBeGreaterThan(0);
  }
});

test('strict delivery unit rejects a changed content identity', async () => {
  const index = parseDeliveryIndex(await Bun.file('public/fundamentals/delivery/index.json').json());
  const entry = index.units[0];
  if (!entry) throw new Error('missing first delivery index entry');
  const asset = await Bun.file(`public/fundamentals/delivery/${entry.slug}.json`).json();
  asset.contentVersion = '0'.repeat(64);
  expect(() => parseDeliveryUnit(asset, entry)).toThrow('Invalid delivery unit asset');
});
