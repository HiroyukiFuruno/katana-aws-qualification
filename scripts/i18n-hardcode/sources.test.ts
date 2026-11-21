import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkSources } from './check.ts';
import { readSources } from './sources.ts';

test('recursively includes every TS/TSX source with stable ordering and no directory exclusions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'i18n-recursive-'));
  await mkdir(join(root, 'nested', 'deeper'), { recursive: true });
  await writeFile(join(root, 'root.tsx'), 'export const Root=()=><p>Root text</p>');
  await writeFile(
    join(root, 'nested', 'deeper', 'hidden.tsx'),
    'export const Hidden=()=><p>Nested text</p>',
  );
  await writeFile(join(root, 'nested', 'data.ts'), 'export const text="Configuration only"');
  await writeFile(join(root, 'style.css'), 'body {color:red}');
  const sources = await readSources(root);
  expect(sources.map((source) => source.path)).toEqual([
    join(root, 'nested', 'data.ts'),
    join(root, 'nested', 'deeper', 'hidden.tsx'),
    join(root, 'root.tsx'),
  ]);
  expect(checkSources(sources, root).map((finding) => finding.text)).toEqual([
    'Nested text',
    'Root text',
  ]);
});

test('invalid TypeScript fails analysis instead of being silently skipped', async () => {
  const root = await mkdtemp(join(tmpdir(), 'i18n-invalid-'));
  await writeFile(join(root, 'bad.tsx'), 'export const View = () => <p>');
  await expect(readSources(root)).rejects.toThrow();
});
