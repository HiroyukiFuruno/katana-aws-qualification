import { expect, test } from 'bun:test';
import { makeAttempt } from '../src/attempts';
import { advanceSession, createSession, sessionComplete } from '../src/fundamentals/session';
import type { FundamentalsQuestion, FundamentalsUnit } from '../src/fundamentals/types';

function question(id: string, unitId: string): FundamentalsQuestion {
  return {
    id,
    unitId,
    revision: 1,
    category: 'cloud',
    version: '1',
    title: id,
    prompt: id,
    choices: [
      { id: 'A', text: 'A', explanation: 'A' },
      { id: 'B', text: 'B', explanation: 'B' },
    ],
    correct: ['A'],
    source: { url: 'https://example.com', label: 'fixture' },
    selectionPolarity: 'correct',
    requiredChoices: 1,
  };
}

function unit(id: string, ids: string[]): FundamentalsUnit {
  return {
    id,
    order: 1,
    title: id,
    summary: id,
    prerequisites: [],
    objective: id,
    explanation: [id],
    example: id,
    questions: ids.map((questionId) => question(questionId, id)),
  };
}

const first = unit('first', ['q1', 'q2', 'q3']);
const wrong = makeAttempt([], first.questions[0], ['B'], 'study', 0, '2026-01-01T00:00:00Z');
const wrongSecond = makeAttempt([wrong], first.questions[1], ['B'], 'study', 0, '2026-01-01T00:01:00Z');

test('復習開始時のキューは回答履歴更新後も固定され、正解後も結果を表示できる', () => {
  const session = createSession(first, [wrong, wrongSecond], true);
  const order = session.questions.map((item) => item.id);
  const answer = makeAttempt(
    [wrong, wrongSecond],
    session.questions[0],
    ['A'],
    'review',
    0,
    '2026-01-01T00:02:00Z',
  );
  const updatedHistory = [wrong, wrongSecond, answer];
  expect(updatedHistory.at(-1)?.isCorrect).toBe(true);
  expect([...order].sort()).toEqual(['q1', 'q2']);
  expect(session.questions.map((item) => item.id)).toEqual(order);
  expect(session.questions[session.index]?.id).toBe(order[0]);
  expect(advanceSession(session).questions[1]?.id).toBe(order[1]);
});

test('未回答は復習に含めず、最新回答が正解なら対象から外す', () => {
  const corrected = makeAttempt([wrong], first.questions[0], ['A'], 'review', 0, '2026-01-01T00:02:00Z');
  expect(
    createSession(first, [wrong, wrongSecond, corrected], true).questions.map((item) => item.id),
  ).toEqual(['q2']);
  expect(createSession(first, [], true).questions).toEqual([]);
});

test('残問題を順に進め、最後の回答後は結果表示のため現在の問題に留まる', () => {
  const start = createSession(first, [], false);
  const next = advanceSession(start);
  expect(next.unitId).toBe('first');
  expect(next.questions[next.index]?.id).toBe(start.questions[1].id);
  const last = advanceSession(next);
  expect(last.questions[last.index]?.id).toBe(start.questions[2].id);
  expect(sessionComplete(last)).toBe(true);
  expect(advanceSession(last)).toEqual(last);
});
