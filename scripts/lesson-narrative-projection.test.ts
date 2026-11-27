import { expect, test } from 'bun:test';
import { planFundamentalsNarratives } from './fundamentals-narrative-jobs';
import { assertLessonTranslationSource, readLessonTranslation } from './project-lesson-translation';

const choices = [
  { id: 'A', text: '復旧時刻を確認する。', explanation: '復旧条件を確かめます。' },
  { id: 'B', text: '確認を省く。', explanation: '条件が分からないまま残ります。' },
];
const authored = {
  id: 'restore-1',
  unitId: 'fundamentals.recovery',
  title: '復旧の確認',
  prompt: '運用担当者が復旧を確認する方法を1つ選んでください。',
  choices,
  requiredChoices: 1,
  selectionPolarity: 'correct',
  correct: ['A'],
  revision: 1,
  version: 'fixture',
  learning: { reason: '復旧時刻を記録します。' },
};
const { learning: _learning, title, ...fields } = authored;
const delivered = { ...fields, title };
const fixture = [
  { path: 'fundamentals/content.json', data: { units: [{ questions: [authored] }] } },
  { path: 'fundamentals/delivery/recovery.json', data: { finalQuestions: [delivered] } },
];
const plan = planFundamentalsNarratives(fixture)[1].units[0];
const translated = {
  units: [
    {
      questions: [
        {
          ...authored,
          title: 'Checking recovery',
          prompt: 'The operator checks system recovery. Choose one action.',
        },
      ],
    },
  ],
};

test('delivery reads only the authored question cache and projects the changed field order', async () => {
  expect(plan.source.hash).not.toBe(plan.unit.hash);
  const original = plan.source.fields.map(({ path }) => path.join('.'));
  const cache = new Map([
    [plan.source.hash, { locales: { en: original }, model: 'fixture', thread: 'proof', usage: null }],
  ]);
  const projection = await readLessonTranslation(plan, async (unit) => {
    const record = cache.get(unit.hash);
    if (!record) throw new Error('Source cache missing');
    return record;
  });
  expect(projection.locales.en).toEqual(plan.unit.fields.map(({ path }) => path.join('.')));
  expect(projection.thread).toBe('proof');
});

test('published validation rejects divergence without relying on the cache', () => {
  const published = plan.unit.fields.map(({ path, text }) => {
    if (path[0] === 'title') return translated.units[0].questions[0].title;
    if (path[0] === 'prompt') return translated.units[0].questions[0].prompt;
    return text;
  });
  expect(() => assertLessonTranslationSource(plan, translated, published, 'fixture')).not.toThrow();
  const edited = published.map((value) => value.replace('The operator', 'The auditor'));
  expect(() => assertLessonTranslationSource(plan, translated, edited, 'fixture')).toThrow(
    'delivered lesson text differs from authoring translation',
  );
});
