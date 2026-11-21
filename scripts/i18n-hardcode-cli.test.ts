import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const checker = resolve(import.meta.dirname, 'check-i18n-hardcode.ts');

test('the command fails on nested UI copy and writes its original location', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'kaq-i18n-cli-'));
  await mkdir(join(cwd, 'src', 'nested'), { recursive: true });
  await writeFile(join(cwd, 'src', 'nested', 'View.tsx'), 'export const View=()=> <p>Save now</p>;');
  const result = spawnSync('node', [checker, '--json', 'result.json'], { cwd, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('src/nested/View.tsx:1:');
  const report: { files: number; findings: { text: string }[] } = JSON.parse(
    await readFile(join(cwd, 'result.json'), 'utf8'),
  );
  expect(report.files).toBe(1);
  expect(report.findings[0].text).toBe('Save now');
});

test('the command accepts non-rendered technical configuration but fails on invalid syntax', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'kaq-i18n-cli-'));
  await mkdir(join(cwd, 'src'));
  const file = join(cwd, 'src', 'config.ts');
  await writeFile(file, 'export const endpoint="/api/resource";');
  expect(spawnSync('node', [checker], { cwd }).status).toBe(0);
  await writeFile(file, 'export const invalid = ;');
  expect(spawnSync('node', [checker], { cwd }).status).not.toBe(0);
});
