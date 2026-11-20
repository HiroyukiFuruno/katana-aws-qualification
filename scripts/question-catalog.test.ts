import { expect, test } from 'bun:test';
import { createQuestionResolver } from '../src/progress/questionCatalog';

function question(id: string, revision: number) {
  return {
    category: 'storage',
    choices: [
      { explanation: 'Explanation', id: 'a', text: 'A' },
      { explanation: 'Explanation', id: 'b', text: 'B' },
    ],
    correct: ['a'],
    id,
    prompt: 'Prompt',
    revision,
    source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
    title: 'Title',
    version: '2026-11',
  };
}

function response(value: unknown) {
  return Promise.resolve(new Response(JSON.stringify(value)));
}

test('resolves a historical revision from only its indexed source bank', async () => {
  const requests: string[] = [];
  const resolve = createQuestionResolver((input) => {
    const path = String(input);
    requests.push(path);
    if (path === '/learning-question-index.v1.json') {
      return response({
        schemaVersion: 1,
        questions: {
          '["question",1]': ['saa-c03', 'courses/saa-c03/questions.json'],
          '["question",2]': ['saa-c03', 'courses/saa-c03/mock-questions.json'],
        },
      });
    }
    if (path === '/courses/saa-c03/questions.json') return response([question('question', 1)]);
    if (path === '/courses/saa-c03/mock-questions.json') return response([question('question', 2)]);
    throw new Error(`Unexpected request: ${path}`);
  });
  await expect(resolve('missing', 1)).resolves.toBeUndefined();
  const historical = await resolve('question', 1);
  expect(historical).toMatchObject({ certificationId: 'saa-c03' });
  expect(requests).toEqual(['/learning-question-index.v1.json', '/courses/saa-c03/questions.json']);
});

test('rejects dangerous catalog paths before loading a bank', async () => {
  const resolve = createQuestionResolver((input) => {
    if (String(input) === '/learning-question-index.v1.json') {
      return response({
        schemaVersion: 1,
        questions: { '["question",1]': ['saa-c03', 'courses/saa-c03/../secret.json'] },
      });
    }
    throw new Error('A dangerous source must not be loaded.');
  });
  await expect(resolve('question', 1)).rejects.toThrow('Question index entry is invalid');
});

test('resolves a historical fundamentals revision from its safe archive', async () => {
  const resolve = createQuestionResolver((input) => {
    if (String(input) === '/learning-question-index.v1.json') {
      return response({
        schemaVersion: 1,
        questions: {
          '["fundamentals-question",1]': ['fundamentals', 'fundamentals/archive/2026-11-questions.json'],
        },
      });
    }
    if (String(input) === '/fundamentals/archive/2026-11-questions.json')
      return response([question('fundamentals-question', 1)]);
    throw new Error(`Unexpected request: ${input}`);
  });
  await expect(resolve('fundamentals-question', 1)).resolves.toMatchObject({
    certificationId: 'fundamentals',
  });
});

test('resolves a checkpoint from its indexed unit bank for later history analysis', async () => {
  const unitId = 'fundamentals.cloud-concepts';
  const id = `${unitId}.checkpoint.example`;
  const checkpoint = { ...question(id, 1), category: unitId };
  const resolver = createQuestionResolver((input) => {
    if (String(input) === '/learning-question-index.v1.json') {
      return response({
        schemaVersion: 1,
        questions: { [JSON.stringify([id, 1])]: ['fundamentals', 'fundamentals/checkpoints.json'] },
      });
    }
    if (String(input) === '/fundamentals/checkpoints.json') {
      return response({ schemaVersion: 1, units: [{ unitId, checkpoints: [checkpoint] }] });
    }
    throw new Error('Unexpected checkpoint source.');
  });
  await expect(resolver(id, 1)).resolves.toMatchObject({
    certificationId: 'fundamentals',
    question: checkpoint,
  });
});
