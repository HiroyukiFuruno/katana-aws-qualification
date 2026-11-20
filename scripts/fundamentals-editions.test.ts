import { expect, spyOn, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createLessonAssets } from '../src/fundamentals/delivery/assets';
import { parseDeliveryIndex } from '../src/fundamentals/delivery/loadIndex';
import { parseDeliveryUnit } from '../src/fundamentals/delivery/loadUnit';
import { seedSql } from './fundamentals-seed-support';

const directory = 'public/fundamentals/delivery/history/2026-11-20';

test('the published edition retains every original asset byte and migration statement', async () => {
  const digest = createHash('sha256');
  const files = (await readdir(directory)).sort();
  expect(files).toHaveLength(15);
  for (const name of files) {
    digest
      .update(name)
      .update('\u0000')
      .update(await readFile(`${directory}/${name}`))
      .update('\u0000');
  }
  expect(digest.digest('hex')).toBe('52502b0c005e796da4a496d7c6cb890b06d14d9f77d8b3352fc26f6b618003ea');
  expect(await seedSql(directory)).toBe(
    await readFile('supabase/migrations/202611200010_fundamentals_catalog.sql', 'utf8'),
  );
  const index = parseDeliveryIndex(await Bun.file(`${directory}/index.json`).json());
  for (const entry of index.units) {
    const asset = parseDeliveryUnit(await Bun.file(`${directory}/${entry.slug}.json`).json(), entry);
    expect(asset.contentVersion).toBe(entry.contentVersion);
  }
});

test('assets resolve exact archived versions without substituting the current questions', async () => {
  const fetch = spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = String(input);
    if (!path.startsWith('/fundamentals/delivery/') || path.includes('..'))
      throw new Error('Unexpected unit-test asset request');
    return new Response(await readFile(`public${path}`, 'utf8'));
  });
  try {
    const assets = createLessonAssets();
    const index = await assets.index();
    const historical = parseDeliveryIndex(await Bun.file(`${directory}/index.json`).json());
    expect((await assets.editions()).map(({ index }) => index.units.length)).toEqual([12, 12]);
    for (const entry of historical.units) {
      const archived = await assets.unit(entry.unitId, entry.contentVersion);
      expect(archived).toEqual(await Bun.file(`${directory}/${entry.slug}.json`).json());
      const current = await assets.unit(entry.unitId);
      expect(current.contentVersion).toBe(
        index.units.find((unit) => unit.unitId === entry.unitId)?.contentVersion,
      );
    }
    const first = historical.units[0];
    if (!first) throw new Error('Missing archived unit');
    await expect(assets.unit(first.unitId, '0'.repeat(64))).rejects.toThrow('no longer published');
  } finally {
    fetch.mockRestore();
  }
});
