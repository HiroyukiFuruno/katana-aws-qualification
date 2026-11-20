import { expect, test } from 'bun:test';
import { createQuestionResolver } from '../src/progress/questionCatalog';

function question() {
  return {
    category: 'storage',
    choices: [
      { explanation: 'Explanation', id: 'a', text: 'A' },
      { explanation: 'Explanation', id: 'b', text: 'B' },
    ],
    correct: ['a'],
    id: 'question',
    prompt: 'Prompt',
    revision: 1,
    source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
    title: 'Title',
    version: '2026-11',
  };
}

function response(value: unknown) {
  return Promise.resolve(new Response(JSON.stringify(value)));
}

const index = {
  schemaVersion: 1,
  questions: { '["question",1]': ['saa-c03', 'courses/saa-c03/questions.json'] },
};

test('retries a failed index load with the same resolver', async () => {
  let requests = 0;
  const resolve = createQuestionResolver((input) => {
    if (String(input) === '/learning-question-index.v1.json') {
      requests++;
      if (requests === 1) return Promise.reject(new Error('index unavailable'));
      return response(index);
    }
    return response([question()]);
  });
  await expect(resolve('question', 1)).rejects.toThrow('index unavailable');
  await expect(resolve('question', 1)).resolves.toMatchObject({ certificationId: 'saa-c03' });
  expect(requests).toBe(2);
});

test('retries a failed bank but reuses the later successful bank', async () => {
  let banks = 0;
  const resolve = createQuestionResolver((input) => {
    if (String(input) === '/learning-question-index.v1.json') return response(index);
    banks++;
    return banks === 1 ? Promise.reject(new Error('bank unavailable')) : response([question()]);
  });
  await expect(resolve('question', 1)).rejects.toThrow('bank unavailable');
  await expect(resolve('question', 1)).resolves.toMatchObject({ certificationId: 'saa-c03' });
  await expect(resolve('question', 1)).resolves.toMatchObject({ certificationId: 'saa-c03' });
  expect(banks).toBe(2);
});

test('shares an inflight bank load between concurrent resolver calls', async () => {
  let release: ((value: Response) => void) | undefined;
  let started: (() => void) | undefined;
  const bankStarted = new Promise<void>((resolveStarted) => {
    started = resolveStarted;
  });
  let banks = 0;
  const resolve = createQuestionResolver((input) => {
    if (String(input) === '/learning-question-index.v1.json') return response(index);
    banks++;
    started?.();
    return new Promise<Response>((resolveResponse) => {
      release = resolveResponse;
    });
  });
  const first = resolve('question', 1);
  const second = resolve('question', 1);
  await bankStarted;
  expect(banks).toBe(1);
  release?.(new Response(JSON.stringify([question()])));
  await expect(Promise.all([first, second])).resolves.toEqual([
    expect.objectContaining({ certificationId: 'saa-c03' }),
    expect.objectContaining({ certificationId: 'saa-c03' }),
  ]);
});
