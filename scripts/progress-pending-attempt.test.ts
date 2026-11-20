import { expect, test } from 'bun:test';
import { makeAttempt } from '../src/attempts';
import { setActiveProgressStore, saveAttempt } from '../src/history';
import { createProgressStore, type ProgressRpcClient } from '../src/progress';
import type { Question } from '../src/questions';
import { MemberRetryQueue } from '../src/progress/retryQueue';
import { memberStore } from './progress-store-fixture';

const question: Question = {
  category: 'storage',
  choices: [
    { explanation: 'Wrong', id: 'W', text: 'Wrong' },
    { explanation: 'Correct', id: 'C', text: 'Correct' },
  ],
  correct: ['C'],
  id: 'q-1',
  prompt: 'Prompt',
  revision: 1,
  source: { label: 'AWS', url: 'https://docs.aws.amazon.com/' },
  title: 'Title',
  version: '2026-11',
};

test('a new answer after a pending wrong answer uses the flushed attempt statistics', async () => {
  const events: {
    attempt_number: number;
    event_id: string;
    prior_incorrect_count: number;
    selected: string[];
  }[] = [];
  let offline = true;
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot') return [];
      if (name !== 'append_learning_event') return;
      const event = args.p_event as (typeof events)[number];
      events.push(event);
      if (offline) throw new Error('offline');
      return 'event-id';
    },
    async select() {
      return [];
    },
  };
  const store = memberStore(client);
  await store.initialize();
  setActiveProgressStore(store);
  try {
    await expect(saveAttempt(question, ['W'], 'study', 1, 'saa-c03', store)).rejects.toThrow('offline');
    offline = false;
    const saved = await saveAttempt(question, ['C'], 'study', 1, 'saa-c03', store);

    expect(events.map((event) => event.selected)).toEqual([['W'], ['W'], ['C']]);
    expect(events[0]?.event_id).toBe(events[1]?.event_id);
    expect(events[2]).toMatchObject({ attempt_number: 2, prior_incorrect_count: 1, selected: ['C'] });
    expect(saved.attempt).toMatchObject({ attemptNumber: 2, priorIncorrectCount: 1, selected: ['C'] });
    expect(saved.history).toHaveLength(2);
  } finally {
    setActiveProgressStore(undefined);
  }
});

test('a partial pending flush contributes every acknowledged earlier answer to the next attempt', async () => {
  const storage = new Map<string, string>();
  const browserStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => void storage.delete(key),
    setItem: (key: string, value: string) => void storage.set(key, value),
  };
  const owner = { kind: 'member' as const, generation: 1, userId: 'member-a' };
  const secondQuestion = { ...question, id: 'q-2' };
  const first = new MemberRetryQueue(owner, browserStorage);
  const second = new MemberRetryQueue(owner, browserStorage);
  await Promise.all([first.setServerGeneration(1), second.setServerGeneration(1)]);
  await first.enqueue('saa-c03', makeAttempt([], question, ['W'], 'study', 1, '2026-11-20T00:00:00Z'));
  await second.enqueue(
    'saa-c03',
    makeAttempt([], secondQuestion, ['W'], 'study', 1, '2026-11-20T00:00:01Z'),
  );

  let failSecond = true;
  const accepted: { question_id: string; attempt_number: number; prior_incorrect_count: number }[] = [];
  const client: ProgressRpcClient = {
    async rpc(name, args) {
      if (name === 'initialize_learning_state') return 1;
      if (name === 'load_roadmap_profile_snapshot') return [];
      if (name !== 'append_learning_event') return;
      const event = args.p_event as (typeof accepted)[number];
      accepted.push(event);
      if (event.question_id === 'q-2' && failSecond) {
        failSecond = false;
        throw new Error('offline');
      }
      return 'event-id';
    },
    async select() {
      return [];
    },
  };
  const store = createProgressStore({ client, isCurrent: () => true, owner, storage: browserStorage });
  await store.initialize();
  setActiveProgressStore(store);
  try {
    await expect(saveAttempt(question, ['C'], 'study', 1, 'saa-c03', store)).rejects.toThrow('offline');
    const saved = await saveAttempt(question, ['C'], 'study', 1, 'saa-c03', store);

    expect(saved.attempt).toMatchObject({ attemptNumber: 2, priorIncorrectCount: 1 });
    expect(accepted.at(-1)).toMatchObject({
      attempt_number: 2,
      prior_incorrect_count: 1,
      question_id: 'q-1',
    });
  } finally {
    setActiveProgressStore(undefined);
  }
});
