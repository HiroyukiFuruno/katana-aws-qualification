import assert from 'node:assert/strict';
import {
  fundamentalsTranslationJobs,
  type NarrativeJson,
  type NarrativeUnit,
  narrativeUnits,
} from './fundamentals-translation-data';

export const fundamentalsAuthoringPath = 'fundamentals/content.json';

export type NarrativePlanEntry = {
  unit: NarrativeUnit;
  source: NarrativeUnit;
  fields?: number[];
};

function question(unit: NarrativeUnit) {
  const value = unit.context;
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert(typeof value.id === 'string' && typeof value.unitId === 'string');
  return { value, key: JSON.stringify([value.unitId, value.id]) };
}

function finalSource(
  unit: NarrativeUnit,
  sourceQuestions: Map<string, NarrativeUnit>,
): NarrativePlanEntry {
  const presented = question(unit);
  const source = sourceQuestions.get(presented.key);
  assert(source, `Fundamentals final question lacks an authoring source: ${presented.key}`);
  const original = question(source);
  assert.deepEqual(presented.value.correct, original.value.correct, presented.key);
  assert.deepEqual(presented.value.choices, original.value.choices, presented.key);
  assert.equal(presented.value.revision, original.value.revision, presented.key);
  assert.equal(presented.value.version, original.value.version, presented.key);
  assert.equal(presented.value.requiredChoices, original.value.requiredChoices, presented.key);
  assert.equal(presented.value.selectionPolarity, original.value.selectionPolarity, presented.key);

  const fields = unit.fields.map((target) => {
    const index = source.fields.findIndex(
      (field) =>
        field.text === target.text &&
        field.path.length === target.path.length &&
        field.path.every((part, position) => part === target.path[position]),
    );
    assert(
      index >= 0,
      `Fundamentals final question field differs: ${presented.key}/${target.path.join('.')}`,
    );
    return index;
  });
  return { unit, source, fields };
}

export function planFundamentalsNarratives(jobs: { path: string; data: NarrativeJson }[]) {
  const entries = jobs.map((job) => ({ ...job, units: narrativeUnits(job.data) }));
  const authoring = entries.find(({ path }) => path === fundamentalsAuthoringPath);
  assert(authoring, 'Fundamentals authoring content is missing');
  const sourceQuestions = new Map(
    authoring.units
      .filter(({ path }) => path.at(-2) === 'questions')
      .map((unit) => [question(unit).key, unit]),
  );
  return entries.map(({ path, data, units }) => ({
    path,
    data,
    units: units.map((unit) =>
      path.startsWith('fundamentals/delivery/') && unit.path[0] === 'finalQuestions'
        ? finalSource(unit, sourceQuestions)
        : { unit, source: unit, fields: undefined },
    ),
  }));
}

export async function fundamentalsNarrativeJobs() {
  return planFundamentalsNarratives(await fundamentalsTranslationJobs());
}
