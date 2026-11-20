import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validFundamentalsContent } from '../src/fundamentals/content';

const value = JSON.parse(await readFile('public/fundamentals/content.json', 'utf8')) as {
  catalog: {
    id: string;
    order: number;
    parent: string;
    prerequisiteIds: string[];
    state: 'published' | 'planned';
    title: string;
    objective: string;
  }[];
  units: {
    id: string;
    order: number;
    questions: {
      unitId: string;
      id: string;
      revision: number;
      selectionPolarity: 'correct' | 'incorrect';
      requiredChoices: number;
      choices: { id: string; text: string; explanation: string }[];
      correct: string[];
      prompt: string;
      source: { url: string; label: string };
    }[];
  }[];
};

assert.equal(value.catalog.length, 12);
assert.equal(value.catalog.filter((item) => item.state === 'published').length, 12);
assert.equal(value.catalog.filter((item) => item.state === 'planned').length, 0);
assert(validFundamentalsContent(value), 'reading, objectives, examples and question references');
assert.equal(new Set(value.catalog.map((item) => item.id)).size, 12);
assert.deepEqual(
  value.catalog.map((item) => item.order).sort((a, b) => a - b),
  Array.from({ length: 12 }, (_, index) => index + 1),
);
assert(
  value.catalog.every((item) =>
    item.prerequisiteIds.every((id) => value.catalog.some((candidate) => candidate.id === id)),
  ),
  'orphan prerequisite',
);
assert.deepEqual(
  new Set(value.catalog.map((item) => item.parent)),
  new Set([
    'cloud.concepts',
    'cloud.services',
    'security.identity',
    'security.data',
    'network.communication',
    'network.naming',
    'network.connectivity',
    'delivery.lifecycle',
  ]),
);
assert.equal(value.units.length, 12);
const published = new Set(
  value.catalog.filter((item) => item.state === 'published').map((item) => item.id),
);
const questionIds = new Set<string>();
const unitIds = new Set<string>();
const forms = new Set<string>();
const formCounts = new Map<string, number>();
for (const unit of value.units) {
  assert(published.has(unit.id), `${unit.id} is not published`);
  assert(!unitIds.has(unit.id), `duplicate unit: ${unit.id}`);
  unitIds.add(unit.id);
  assert.equal(unit.questions.length, 12, unit.id);
  for (const question of unit.questions) {
    assert.equal(question.unitId, unit.id);
    const negativePrompt = /誤って|誤った|誤り|不適切|避けるべき/.test(question.prompt);
    assert.equal(
      negativePrompt,
      question.selectionPolarity === 'incorrect',
      `${question.id}: prompt polarity`,
    );
    assert(
      question.prompt.includes(`${question.requiredChoices}つ`),
      `${question.id}: explicit choice count`,
    );
    assert(!questionIds.has(question.id), question.id);
    questionIds.add(question.id);
    assert(question.revision >= 1, question.id);
    assert(question.requiredChoices === question.correct.length, question.id);
    assert(
      question.correct.every((id) => question.choices.some((choice) => choice.id === id)),
      question.id,
    );
    assert(
      question.choices.every((choice) => choice.text && choice.explanation),
      question.id,
    );
    assert.equal(new URL(question.source.url).protocol, 'https:', question.id);
    const form = `${question.selectionPolarity}:${question.requiredChoices === 1 ? 'single' : 'multiple'}`;
    forms.add(form);
    formCounts.set(form, (formCounts.get(form) ?? 0) + 1);
  }
  const catalogItem = value.catalog.find((item) => item.id === unit.id);
  assert(catalogItem, `missing catalog item: ${unit.id}`);
}
assert.deepEqual(unitIds, published);
assert.deepEqual(
  forms,
  new Set(['correct:single', 'correct:multiple', 'incorrect:single', 'incorrect:multiple']),
);
assert(
  [...formCounts.values()].every((count) => count >= 3),
  'Each answer form needs three questions',
);
console.log(
  `Validated ${value.catalog.length} units, ${questionIds.size} questions, and ${forms.size} answer forms`,
);
