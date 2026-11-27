import assert from 'node:assert/strict';
import type { NarrativePlanEntry } from './fundamentals-narrative-jobs';
import type { NarrativeJson, NarrativeUnit } from './fundamentals-translation-data';
import { type NaturalNarrativeRecord, readNarrative } from './natural-narrative-translation';

export async function readLessonTranslation(
  plan: NarrativePlanEntry,
  read = readNarrative,
): Promise<NaturalNarrativeRecord> {
  const record = await read(plan.source);
  const fields = plan.fields;
  if (!fields) return record;
  return {
    ...record,
    locales: Object.fromEntries(
      Object.entries(record.locales).map(([locale, texts]) => [
        locale,
        fields.map((index) => texts[index]),
      ]),
    ),
  };
}

export function lessonNarrativeTexts(root: NarrativeJson, unit: NarrativeUnit, context: string) {
  return unit.fields.map((field) => {
    let value = root;
    for (const segment of [...unit.path, ...field.path]) {
      assert(value && typeof value === 'object', `${context}: missing lesson field`);
      value = (value as Record<string, NarrativeJson>)[segment];
    }
    assert(typeof value === 'string', `${context}: invalid lesson text`);
    return value;
  });
}

export function assertLessonTranslationSource(
  plan: NarrativePlanEntry,
  authoring: NarrativeJson,
  published: string[],
  context: string,
) {
  if (!plan.fields) return;
  const source = lessonNarrativeTexts(authoring, plan.source, context);
  assert.deepEqual(
    published,
    plan.fields.map((index) => source[index]),
    `${context}: delivered lesson text differs from authoring translation`,
  );
}
