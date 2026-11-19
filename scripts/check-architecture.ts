import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { join, sep } from 'node:path';
import { cruise, type ICruiseResult } from 'dependency-cruiser';
import { parseSync } from '@swc/core';
import rules from '../.dependency-cruiser.cjs';

parseSync('export const probe: number = 1;', { syntax: 'typescript' });
const { output } = await cruise(['src'], {
  ...rules.options,
  ruleSet: { forbidden: rules.forbidden },
  validate: true,
  outputType: 'json',
});
const { modules, summary }: ICruiseResult = typeof output === 'string' ? JSON.parse(output) : output;
const analyzed = new Set(modules.map((module) => module.source));
const sources = (await readdir('src', { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name).split(sep).join('/'));
assert(sources.length > 0 && summary.totalDependenciesCruised > 0, 'No source dependencies analyzed');
const skipped = sources.filter((source) => !analyzed.has(source));
assert.deepEqual(skipped, [], 'Dependency analysis skipped TypeScript source files');

for (const violation of summary.violations) {
  console.error(`${violation.rule.name}: ${violation.from} → ${violation.to}`);
}
if (summary.error) process.exitCode = 1;
else
  console.log(
    `Validated ${sources.length} TypeScript files and ${summary.totalDependenciesCruised} dependencies`,
  );
