import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkSources } from './i18n-hardcode/check.ts';
import { readSources } from './i18n-hardcode/sources.ts';

const root = process.cwd();
const sources = await readSources(resolve(root, 'src'));
if (!sources.length) throw new Error('No TypeScript source files analyzed');
const findings = checkSources(sources, root);
const outputIndex = process.argv.indexOf('--json');
if (outputIndex >= 0) {
  const output = process.argv[outputIndex + 1];
  if (!output || output.startsWith('--')) throw new Error('--json requires an output path');
  await writeFile(
    resolve(root, output),
    `${JSON.stringify({ files: sources.length, findings }, null, 2)}\n`,
  );
}
for (const finding of findings) {
  console.error(
    `${finding.file}:${finding.line}:${finding.column} ${finding.rule}: ${JSON.stringify(finding.text)} (${finding.sink}, ${finding.sinkFile}:${finding.sinkLine})`,
  );
}
console.log(
  `Analyzed ${sources.length} TypeScript files recursively; ${findings.length} untranslated UI origins`,
);
if (findings.length) process.exitCode = 1;
