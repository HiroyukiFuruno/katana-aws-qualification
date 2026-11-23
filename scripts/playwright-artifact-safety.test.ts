import { expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { parseSync } from '@swc/core';
import type { CallExpression, Expression, KeyValueProperty, Module, ObjectExpression } from '@swc/types';

const root = resolve(import.meta.dirname, '..');
const artifactRoot = resolve(root, 'test-results');

function isDefineConfig(node: Expression): node is CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.value === 'defineConfig'
  );
}

function propertyName(property: KeyValueProperty): string | undefined {
  return property.key.type === 'Identifier' || property.key.type === 'StringLiteral'
    ? property.key.type === 'Identifier'
      ? property.key.value
      : property.key.value
    : undefined;
}

function configObjects(module: Module): ObjectExpression[] {
  const exportDefault = module.body.find(
    (node) => node.type === 'ExportDefaultExpression' && isDefineConfig(node.expression),
  );
  if (exportDefault?.type !== 'ExportDefaultExpression' || !isDefineConfig(exportDefault.expression))
    return [];
  return exportDefault.expression.arguments
    .map((argument) => argument.expression)
    .filter((expression): expression is ObjectExpression => expression.type === 'ObjectExpression');
}

function outputValues(source: string): Expression[] {
  const module = parseSync(source, { syntax: 'typescript', tsx: false });
  return configObjects(module)
    .flatMap((object) => object.properties)
    .filter((property): property is KeyValueProperty => property.type === 'KeyValueProperty')
    .filter((property) => propertyName(property) === 'outputDir')
    .map((property) => property.value);
}

function safeOutputDir(value: Expression, configPath: string): boolean {
  if (value.type === 'StringLiteral') {
    const absolute = resolve(dirname(resolve(root, configPath)), value.value);
    const insideArtifacts = relative(artifactRoot, absolute);
    return (
      insideArtifacts !== '' &&
      !insideArtifacts.startsWith(`..${sep}`) &&
      basename(absolute) === 'artifacts'
    );
  }
  if (value.type === 'TemplateLiteral') {
    const last = value.quasis.at(-1)?.raw ?? '';
    return (
      last.endsWith('/browser') &&
      value.expressions.some(
        (expression) => expression.type === 'Identifier' && expression.value === 'artifacts',
      )
    );
  }
  return false;
}

function validateSource(source: string, configPath: string): string[] {
  const values = outputValues(source);
  if (values.length === 0) return ['missing top-level defineConfig outputDir'];
  return values.flatMap((value) => (safeOutputDir(value, configPath) ? [] : ['unsafe outputDir']));
}

async function playwrightConfigs(): Promise<string[]> {
  const rootEntries = await readdir(root, { withFileTypes: true });
  const testEntries = await readdir(resolve(root, 'test'), { withFileTypes: true });
  const rootConfigs = rootEntries
    .filter((entry) => entry.isFile() && /^playwright.*\.config\.ts$/.test(entry.name))
    .map((entry) => entry.name);
  const testConfigs = testEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `test/${entry.name}/playwright.config.ts`);
  const existingTestConfigs = await Promise.all(
    testConfigs.map(async (path) => ((await Bun.file(resolve(root, path)).exists()) ? path : undefined)),
  );
  return [
    ...rootConfigs,
    ...existingTestConfigs.filter((path): path is string => path !== undefined),
  ].sort();
}

test('all Playwright configs own a dedicated artifact directory', async () => {
  const configs = await playwrightConfigs();
  expect(configs).toHaveLength(8);
  const failures = await Promise.all(
    configs.map(async (configPath) => ({
      configPath,
      failures: validateSource(await readFile(resolve(root, configPath), 'utf8'), configPath),
    })),
  );
  expect(failures.filter(({ failures: errors }) => errors.length)).toEqual([]);
});

test('AST guard rejects missing and shared output directories while accepting a dedicated path', () => {
  const missing = `export default defineConfig({ test: { outputDir: 'test-results/ads/artifacts' } });`;
  const shared = `export default defineConfig({ outputDir: 'test-results' });`;
  const safe = `export default defineConfig({ outputDir: 'test-results/example/artifacts' });`;
  const nestedFixture = `// outputDir: 'test-results'\nconst fixture = { outputDir: 'test-results' };\nexport default defineConfig({});`;

  expect(validateSource(missing, 'playwright.ads.config.ts')).toHaveLength(1);
  expect(validateSource(shared, 'playwright.ads.config.ts')).toHaveLength(1);
  expect(validateSource(safe, 'playwright.ads.config.ts')).toEqual([]);
  expect(validateSource(nestedFixture, 'playwright.ads.config.ts')).toHaveLength(1);
});
