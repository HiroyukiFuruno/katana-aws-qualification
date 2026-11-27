import { expect, test } from 'bun:test';
import { makeAttempt } from '../src/attempts';
import { dashboardGuestAttempts } from '../src/dashboard/guestAttempts';
import legacy from '../src/fundamentals/delivery/legacyRecordAssets.json';
import { parseCheckpointQuestions } from '../src/fundamentals/checkpointQuestions';
import { locales } from '../src/locales';
import {
  createLocalizedQuestionResolver,
  createQuestionResolver,
} from '../src/progress/questionCatalog';
import { type Question, parseQuestions, questionKey } from '../src/questions';

const retainedPaths = [
  'fundamentals/archive/2026-11-27-questions.json',
  'fundamentals/archive/2026-11-20-questions.json',
];
const read = async (path: string) => Bun.file(`public/${path}`).json();
async function historyQuestions(prefix = '') {
  return (
    await Promise.all(retainedPaths.map(async (path) => parseQuestions(await read(prefix + path))))
  ).flat();
}
const fetchAsset = (path: RequestInfo | URL) =>
  Promise.resolve(
    new Response(Bun.file(`public${String(path)}`), { headers: { 'Content-Type': 'application/json' } }),
  );

test('all 200 retained questions still count for guests and resolve for localized review', async () => {
  const historical = await historyQuestions();
  const resolve = createQuestionResolver(fetchAsset);
  expect(historical).toHaveLength(200);
  const attempts = historical.map((question) => {
    const distractor = question.choices.find(({ id }) => !question.correct.includes(id));
    if (!distractor) throw new Error(`Missing distractor in ${question.id}`);
    const selected = [distractor.id, ...question.correct.slice(1)];
    return makeAttempt([], question, selected, 'study', 1000, '2026-11-27T19:00:00Z');
  });
  const result = await dashboardGuestAttempts(attempts, resolve);
  expect(result.excludedRecords).toBe(0);
  expect(result.events).toHaveLength(200);
  expect(result.events.every(({ isCorrect }) => !isCorrect)).toBe(true);

  for (const locale of locales) {
    const localized = createLocalizedQuestionResolver(locale, fetchAsset);
    const expected = locale === 'ja' ? historical : await historyQuestions(`translations/${locale}/`);
    expect(expected.map(questionKey)).toEqual(historical.map(questionKey));
    for (const [index, question] of expected.entries()) {
      const result = await localized(question.id, question.revision);
      expect(result?.certificationId).toBe('fundamentals');
      expect(result?.question.prompt).toBe(question.prompt);
      expect(result?.question.choices).toEqual(question.choices);
      expect(result?.question.correct).toEqual(historical[index].correct);
    }
  }
});

test('new fundamentals answers use separate revisions from the archived grading key', async () => {
  const historical = await historyQuestions();
  const content = (await read('fundamentals/content.json')) as { units: { questions: Question[] }[] };
  const current = content.units.flatMap(({ questions }) => questions);
  const checkpoints = parseCheckpointQuestions(await read('fundamentals/checkpoints.json'));
  const old = new Set(historical.map(questionKey));
  expect([...current, ...checkpoints].filter((question) => old.has(questionKey(question)))).toEqual([]);

  const before = historical.find(({ id }) => id === 'fund-data-107');
  const after = current.find(({ id }) => id === 'fund-data-107');
  if (!before || !after) throw new Error('Missing regression question');
  expect(before.revision).toBe(2);
  expect(after.revision).toBeGreaterThan(before.revision);
  const resolve = createQuestionResolver(fetchAsset);
  expect((await resolve(before.id, before.revision))?.question.correct).toEqual(['A']);
  expect((await resolve(after.id, after.revision))?.question.correct).toEqual(['A', 'B']);
});

test('all 18 prior grading catalogs can resolve their saved question identities', async () => {
  const resolve = createQuestionResolver(fetchAsset);
  expect(legacy.assets).toHaveLength(18);
  for (const asset of legacy.assets) {
    for (const question of [...asset.checkpoints, ...asset.finalQuestions]) {
      const resolved = await resolve(question.id, question.revision);
      expect(resolved?.question.version).toBe(question.version);
      expect(resolved?.question.correct).toEqual(question.correct);
    }
  }
});
