import { expect, test } from 'bun:test';
import { createExamClock, elapsedExamMs, examNow } from '../src/examClock';

test('elapsed exam time is an integer and never negative', () => {
  expect(elapsedExamMs(100, 105.9)).toBe(5);
  expect(elapsedExamMs(100, 99.9)).toBe(0);
});

test('member exam time follows the monotonic anchor across wall-clock jumps', () => {
  const originalNow = Date.now;
  const originalPerformanceNow = performance.now;
  let monotonic = 100;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => monotonic });
  Date.now = () => 9_999_999;
  try {
    const clock = createExamClock(new Date(1_000_000).toISOString());
    const draft = { clock };
    expect(examNow(draft)).toBe(1_000_000);
    monotonic += 5_000;
    Date.now = () => 1;
    expect(examNow(draft)).toBe(1_005_000);
  } finally {
    Date.now = originalNow;
    Object.defineProperty(performance, 'now', { configurable: true, value: originalPerformanceNow });
  }
});

test('legacy guest drafts keep wall-clock behavior', () => {
  const originalNow = Date.now;
  Date.now = () => 1234;
  try {
    expect(examNow()).toBe(1234);
  } finally {
    Date.now = originalNow;
  }
});
