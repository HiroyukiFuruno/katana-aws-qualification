import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { checkLegacyNaturalExports, legacyNaturalExports } from './legacy-natural-exports';

if (process.argv.includes('--check')) await checkLegacyNaturalExports();
else {
  let outputs: Awaited<ReturnType<typeof legacyNaturalExports>> | undefined;
  try {
    outputs = await legacyNaturalExports();
  } catch (error) {
    if (
      error instanceof assert.AssertionError ||
      (error instanceof Error && error.message === 'invalidQuestionData') ||
      (error instanceof Error && 'code' in error && error.code === 'ENOENT')
    )
      console.log(`Pending legacy natural translation export: ${String(error)}`);
    else throw error;
  }
  for (const { locale, payload, manifest } of outputs ?? []) {
    await writeFile(
      `public/courses/ai-business-strategist/locales/${locale}.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    await writeFile(
      `public/translations/${locale}/legacy-natural-manifest.json`,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }
  if (outputs) console.log(`Materialized ${outputs.length} legacy natural translation exports`);
}
