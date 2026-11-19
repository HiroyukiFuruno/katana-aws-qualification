import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { scripts } from '../package.json' with { type: 'json' };

const root = resolve(import.meta.dir, '..');
const binaryPath = join(root, 'node_modules', '.bin');

async function withFixture(operation: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'kaq-static-check-'));
  try {
    await operation(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function run(directory: string, ...command: string[]) {
  const { exitCode, stdout, stderr } = Bun.spawnSync(command, {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${binaryPath}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`,
    },
  });
  return { exitCode, output: stdout.toString() + stderr.toString() };
}

test('Biome accepts the 150th line and rejects the 151st line', async () => {
  await withFixture(async (directory) => {
    await Bun.write(join(directory, 'biome.json'), Bun.file(join(root, 'biome.json')));
    for (const length of [150, 151]) {
      const source = Array.from({ length }, (_, index) => `export const value${index} = ${index};`);
      const path = `src/limit-${length}.ts`;
      await Bun.write(join(directory, path), `${source.join('\n')}\n`);
      const result = run(directory, 'biome', 'lint', path);
      expect(result.exitCode, result.output).toBe(length === 150 ? 0 : 1);
      if (length === 151) expect(result.output).toContain('noExcessiveLinesPerFile');
    }
  });
});

test('the similarity gate rejects a renamed implementation', async () => {
  const source = `export function summarize(input: number[]) {
  const selection = input.filter((entry) => Number.isFinite(entry));
  const positives = selection.filter((entry) => entry > 0);
  const sorted = positives.sort((left, right) => right - left);
  if (sorted.length < 2) {
    return { count: sorted.length, average: 0, biggest: sorted[0] };
  }
  const total = sorted.reduce((sum, entry) => sum + entry, 0);
  const average = Math.round((total / sorted.length) * 100) / 100;
  return { count: sorted.length, average, biggest: sorted[0] };
}
`;
  await withFixture(async (directory) => {
    await Bun.write(join(directory, 'package.json'), JSON.stringify({ scripts }));
    await Bun.write(join(directory, 'src/first.ts'), source);
    await Bun.write(join(directory, 'scripts/helper.ts'), 'export const helper = true;\n');
    const clean = run(directory, process.execPath, 'run', 'duplicates:check');
    expect(clean.exitCode, clean.output).toBe(0);
    const renamed = source
      .replaceAll('summarize', 'analyze')
      .replaceAll('selection', 'values')
      .replaceAll('sorted', 'ordered')
      .replaceAll('total', 'sumOfValues');
    await Bun.write(join(directory, 'src/second.ts'), renamed);
    const duplicate = run(directory, process.execPath, 'run', 'duplicates:check');
    expect(duplicate.exitCode, duplicate.output).toBe(1);
    expect(duplicate.output).toContain('similar (ast)');
  });
});

test('dependency validation catches cycles and domain-to-interface imports', async () => {
  await withFixture(async (directory) => {
    await Bun.write(join(directory, 'tsconfig.json'), Bun.file(join(root, 'tsconfig.json')));
    await Bun.write(join(directory, 'src/questions.ts'), 'export const title = "guide";\n');
    await Bun.write(
      join(directory, 'src/Guide.tsx'),
      "import { title } from './questions.ts';\nexport const guide = () => title;\n",
    );
    const command = ['node', join(root, 'scripts/check-architecture.ts')];
    const clean = run(directory, ...command);
    expect(clean.exitCode, clean.output).toBe(0);
    await Bun.write(
      join(directory, 'src/questions.ts'),
      "import { guide } from './Guide.tsx';\nexport const title = () => guide();\n",
    );
    const violation = run(directory, ...command);
    expect(violation.exitCode, violation.output).toBe(1);
    expect(violation.output).toContain('domain-does-not-import-interface');
    expect(violation.output).toContain('no-circular-dependencies');
  });
});
